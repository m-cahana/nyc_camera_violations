let histDataset, mapDataset, mapPlates;
let svg, g;
let xLabel, yLabel;
let plates, selectedPlateDates;
let cumXScale, cumYScale;
let xAxis, yAxis;
let simulation;
let selectedPlateID = null;
let map, mapContainer; // Global map instance
let selectButton;

const MARGIN = { LEFT: 100, RIGHT: 100, TOP: 50, BOTTOM: 20 };
let WIDTH = 800;
let HEIGHT = 500;

let HEIGHT_WIDTH_RATIO = HEIGHT / WIDTH;

const DOT = { RADIUS: 5, OPACITY: 0.2 };

import { scroller } from "./scroller.js";

// Read Data, convert numerical categories into floats
// Create the initial visualisation

d3.csv("data/processed/school_zone_violations_sparser.csv").then((data) => {
  data.forEach((d) => {
    d.row_pct = Number(d.row_pct * 100);
    d.cum_share = Number(d.cum_share * 100);
    d.school_zone_violations = Number(d.school_zone_violations);
  });

  histDataset = data;
  plates = histDataset.map((d) => d.plate_id);

  setTimeout(drawInitial, 100); // Corrected to pass function without invoking
});

// read
d3.csv("data/processed/repeat_offenders_lat_long_sample.csv").then((data) => {
  data.forEach((d) => {
    d.lat = Number(d.lat);
    d.long = Number(d.long);
    d.issue_dt = new Date(d.issue_dt);
  });

  mapDataset = data.filter((d) => d.lat != 0 && d.long != 0);
  mapPlates = [...new Set(data.map((d) => d.plate_id))];

  // Sort the dataset by date for efficient processing
  mapDataset.sort((a, b) => a.issue_dt - b.issue_dt);
});

// Function to position the labels dynamically
function positionLabels() {
  // Calculate current width and height from scales
  const currentWidth = cumXScale.range()[1] - cumXScale.range()[0];
  const currentHeight = cumYScale.range()[0] - cumYScale.range()[1];

  // Position X Label: centered horizontally, slightly below the X axis
  xLabel
    .attr("x", (cumXScale.range()[0] + cumXScale.range()[1]) / 2)
    .attr("y", cumYScale.range()[0] + 30)
    .attr("dy", "0.71em"); // Fine-tune vertical alignment

  // Position Y Label: centered vertically, slightly left of the Y axis
  yLabel
    .attr("x", -(cumYScale.range()[0] + cumYScale.range()[1]) / 2)
    .attr("y", MARGIN.LEFT - 50)
    .attr("dy", "0.71em"); // Fine-tune horizontal alignment
}

// Function to update dimensions based on container size
function updateDimensions() {
  const container = document.getElementById("vis");
  const containerWidth = container.clientWidth;

  const newWidth = Math.min(WIDTH, containerWidth);
  const newHeight = newWidth * HEIGHT_WIDTH_RATIO;

  console.log(containerWidth);

  // Update scales
  cumXScale.range([MARGIN.LEFT, newWidth - MARGIN.RIGHT]);
  cumYScale.range([newHeight - MARGIN.BOTTOM, MARGIN.TOP]);

  // update axes
  xAxis
    .attr("transform", `translate(0,${newHeight - MARGIN.BOTTOM})`)
    .call(d3.axisBottom(cumXScale).tickFormat((d) => `${d}%`));

  yAxis.call(d3.axisLeft(cumYScale).tickFormat((d) => `${d}%`));

  positionLabels();

  // Update SVG size
  svg
    .attr("width", newWidth + MARGIN.LEFT + MARGIN.RIGHT)
    .attr("height", newHeight + MARGIN.TOP + MARGIN.BOTTOM);

  svg
    .selectAll(".nodes")
    .attr("cx", (d) => cumXScale(d.row_pct))
    .attr("cy", (d) => cumYScale(d.cum_share));

  // Update image positions if necessary
  svg
    .select(".embedded-image")
    .attr("x", newWidth / 2 - 50)
    .attr("y", newHeight / 4)
    .attr("transform", `rotate(0, ${WIDTH / 2}, ${HEIGHT / 2})`);

  svg
    .select(".image-group foreignObject")
    .attr("x", newWidth / 2 - 100)
    .attr("y", newHeight / 4 + 270);

  svg
    .select(".map-foreignobject")
    .attr("width", newWidth) // Adjust based on your layout
    .attr("height", newHeight);
}

// All the initial elements should be created in the drawInitial function
// As they are required, their attributes can be modified
// They can be shown or hidden using their 'opacity' attribute
// Each element should also have an associated class name for easy reference

function drawInitial() {
  // axes
  cumXScale = d3
    .scaleLinear()
    .domain([0, 100])
    .range([MARGIN.LEFT, WIDTH - MARGIN.RIGHT]);

  cumYScale = d3
    .scaleLinear()
    .domain([0, 100])
    .range([HEIGHT - MARGIN.BOTTOM, MARGIN.TOP]);

  svg = d3
    .select("#vis")
    .append("svg")
    .attr("width", WIDTH + MARGIN.LEFT + MARGIN.RIGHT)
    .attr("height", HEIGHT + MARGIN.TOP + MARGIN.BOTTOM)
    .attr("opacity", 1);

  // labels
  xLabel = svg.append("text").attr("class", "x-label").text("Share of drivers");

  yLabel = svg
    .append("text")
    .attr("class", "y-label")
    .attr("transform", "rotate(-90)")
    .text("Share of school zone violations");

  positionLabels();

  xAxis = svg
    .append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${HEIGHT - MARGIN.BOTTOM})`);

  xAxis.call(d3.axisBottom(cumXScale).tickFormat((d) => `${d}%`));

  yAxis = svg
    .append("g")
    .attr("class", "y-axis")
    .attr("transform", `translate(${MARGIN.LEFT},0)`);

  yAxis.call(d3.axisLeft(cumYScale).tickFormat((d) => `${d}%`));

  // Instantiate the force simulation
  simulation = d3.forceSimulation(histDataset);

  // Define each tick of simulation
  simulation.on("tick", () => {
    nodes.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
  });

  // Selection of all the circles
  // Append a div element for the tooltip (hidden by default)
  const tooltip = d3.select("body").append("div").attr("class", "tooltip");

  // Create nodes
  const nodes = svg
    .selectAll("circle")
    .data(histDataset)
    .enter()
    .append("circle")
    .attr("class", "nodes")
    .attr("cx", function (d) {
      return cumXScale(d.row_pct);
    })
    .attr("cy", function (d) {
      return cumYScale(d.cum_share);
    })
    .attr("r", DOT.RADIUS)
    .attr("opacity", DOT.OPACITY)
    .attr("fill", "blue")
    .on("mouseover", function (event, d) {
      if (d3.select(this).attr("opacity") > 0) {
        // Show the tooltip
        tooltip
          .html(
            `<strong>Plate ID:</strong> ${d.plate_id}<br>
           <strong>Registration state:</strong> ${d.registration_state}
           <br>
           <strong>Plate type:</strong> ${d.plate_type}
           <br>
           <strong>School Zone Violations:</strong> ${d.school_zone_violations}
           `
          )
          .style("left", `${event.pageX + 10}px`) // Position tooltip near the mouse
          .style("top", `${event.pageY + 10}px`)
          .classed("visible", true);

        // Optionally, highlight the node
        d3.select(this).attr("stroke", "orange").attr("stroke-width", 8);
      }
    })
    .on("mousemove", function (event) {
      // Update tooltip position as the mouse moves
      tooltip
        .style("left", `${event.pageX + 10}px`)
        .style("top", `${event.pageY + 10}px`);
    })
    .on("mouseout", function () {
      // Hide the tooltip
      tooltip.classed("visible", false);

      // Remove highlight
      d3.select(this).attr("stroke", "none");
    });

  // Stop the simulation until later
  simulation
    .force("forceX", d3.forceX((d) => cumXScale(d.row_pct)).strength(0.075))
    .force("forceY", d3.forceY((d) => cumYScale(d.cum_share)).strength(0.075))
    .force("collide", d3.forceCollide().radius(1.5));

  simulation.alpha(0.75).restart();

  // Append the Mapbox foreignObject, positioned to the right of the dropdown
  svg
    .append("foreignObject")
    .attr("width", WIDTH)
    .attr("height", HEIGHT)
    .attr("x", 0)
    .attr("y", MARGIN.TOP)
    .attr("class", "map-foreignobject")
    .style("display", "none") // Hidden by default
    .append("xhtml:div")
    .attr("id", "map"); // This div will host the Mapbox map

  mapContainer = d3.select("#map");

  mapContainer
    .append("div")
    .attr("id", "date-display")
    .style("position", "absolute");

  const selectWrapper = mapContainer.append("div").attr("id", "select-wrapper");

  // Append a label for the selectButton
  selectWrapper
    .append("label")
    .attr("for", "selectButton")
    .text("Plate ID: ")
    .style("margin-right", "5px")
    .style("font-size", "14px")
    .style("color", "#333");

  // Append the select element to the wrapper
  selectButton = selectWrapper
    .append("select")
    .attr("id", "selectButton")
    .style("width", "200px"); // Adjust width as needed

  // Add options to the selectButton
  selectButton
    .selectAll("option")
    .data(mapPlates)
    .enter()
    .append("option")
    .text((d) => d)
    .attr("value", (d) => d);

  // dropdown will be initialized to first element
  selectedPlateID = mapPlates[0];

  const imageGroup = svg
    .append("g")
    .attr("class", "image-group") // Assign a class for easy selection
    .style("opacity", 0) // Initially hidden
    .style("pointer-events", "none");

  // Embed the PNG image within the group
  imageGroup
    .append("image")
    .attr("href", "images/crash-car-1.png") // Replace with your PNG path
    .attr("x", WIDTH / 2 - 50) // Adjust x position
    .attr("y", HEIGHT / 4) // Adjust y position
    .attr("width", 300) // Adjust width
    .attr("height", 300) // Adjust height
    .attr("class", "embedded-image") // Assign a class for styling
    // Initial rotation set to 0 degrees
    .attr("transform", `rotate(0, ${WIDTH / 2}, ${HEIGHT / 2})`);

  // Append the caption text beneath the image within the same group
  imageGroup
    .append("foreignObject")
    .attr("x", WIDTH / 2 + 100 - 100) // Adjust x as needed
    .attr("y", HEIGHT / 4 + 300 - 30) // Adjust y as needed
    .attr("width", 200) // Adjust width as needed
    .attr("height", 50) // Adjust height as needed
    .style("pointer-events", "none") // Ensure it doesn't capture mouse events
    .append("xhtml:div") // Must use XHTML namespace
    .style("text-align", "center") // Center text
    .style("font-size", "12px")
    .style("color", "black")
    .html(
      "<span>Repeat offender crash in 2021</span><br/><span>Photo by Liam Quiqley</span>"
    );

  // Add window resize listener
  window.addEventListener("resize", updateDimensions);
}

// Function to show and rotate the image group
function showImage() {
  const imageGroup = d3.select(".image-group");

  imageGroup
    .transition()
    .duration(500) // Duration of the transition in milliseconds
    .style("opacity", 1) // Fade in the group
    .attrTween("transform", function () {
      const cx = WIDTH / 2;
      const cy = HEIGHT / 2;
      // Interpolate rotation from 0 to 30 degrees around the center
      return d3.interpolateString(
        `rotate(0, ${cx}, ${cy})`,
        `rotate(30, ${cx}, ${cy})`
      );
    });
}

// Function to hide and reset the image group
function hideImage() {
  const imageGroup = d3.select(".image-group");

  imageGroup
    .transition()
    .duration(500) // Duration of the transition in milliseconds
    .style("opacity", 0) // Fade out the group
    .attr("transform", `rotate(0, ${WIDTH / 2}, ${HEIGHT / 2})`); // Reset rotation
}

function hideMap() {
  svg.select(".map-foreignobject").style("display", "none");
}

function regenerateAxes(data, nodes) {
  // Calculate the maximum values in `limitedData`
  const minRowPct = d3.min(data, (d) => d.row_pct);
  const minCumShare = d3.min(data, (d) => d.cum_share);

  const maxRowPct = Math.ceil(d3.max(data, (d) => d.row_pct) / 5) * 5;
  const maxCumShare = Math.ceil(d3.max(data, (d) => d.cum_share) / 5) * 5;

  // Update scales to reflect the new maximum values
  cumXScale.domain([minRowPct, maxRowPct]);
  cumYScale.domain([minCumShare, maxCumShare]);

  xAxis
    .transition()
    .duration(500)
    .call(d3.axisBottom(cumXScale).tickFormat((d) => `${d}%`));
  yAxis
    .transition()
    .duration(500)
    .call(d3.axisLeft(cumYScale).tickFormat((d) => `${d}%`));
}

function drawHist(xLower = 0, xHigher = 100) {
  const svg = d3.select("#vis").select("svg");

  svg.select(".x-label").style("display", "block");
  svg.select(".y-label").style("display", "block");

  svg.select(".x-axis").style("display", "block");
  svg.select(".y-axis").style("display", "block");

  svg.selectAll(".nodes").style("display", "block");

  // Filter the histDataset to include only a subset of nodes
  const limitedData = histDataset.filter((d) => {
    return d.row_pct >= xLower && d.row_pct <= xHigher;
  });

  // Regenerate axes based on the limited data
  regenerateAxes(limitedData);

  // Bind all existing nodes to the full histDataset (don't remove any nodes)
  const nodes = svg.selectAll(".nodes").data(histDataset);

  // Update all nodes
  nodes
    .transition()
    .duration(500)
    .attr("cx", (d) => cumXScale(d.row_pct))
    .attr("cy", (d) => cumYScale(d.cum_share))
    .attr("r", DOT.RADIUS)
    .attr("opacity", (d) => (limitedData.includes(d) ? DOT.OPACITY : 0)); // Semi-transparent for others

  // Restart the simulation to reflect changes
  simulation
    .nodes(histDataset) // Keep the full histDataset in the simulation
    .alpha(0.75)
    .restart();
}

function cleanHist() {
  const svg = d3.select("#vis").select("svg");

  svg.select(".x-label").style("display", "none");
  svg.select(".y-label").style("display", "none");

  svg.select(".x-axis").style("display", "none");
  svg.select(".y-axis").style("display", "none");

  svg.selectAll(".nodes").style("display", "none");
}

// Function to draw the Mapbox map (as defined earlier)

// Insert the drawMapbox function here or in another script tag
// For clarity, include it here again:

function drawMapbox() {
  // Show the foreignObject containing the map
  d3.select(".map-foreignobject").style("display", "block");

  // Ensure the SVG remains visible
  d3.select("svg").style("opacity", 1);

  selectButton = d3.select("#map").select("#selectButton");

  // Event listener for selectButton
  selectButton.on("change", function () {
    selectedPlateID = d3.select(this).property("value");
    adjustMapBounds(selectedPlateID);
  });

  // Initialize the Mapbox map
  mapboxgl.accessToken =
    "pk.eyJ1IjoibWljaGFlbC1jYWhhbmEiLCJhIjoiY201ZnhkcG05MDJleTJscHhhNm15MG1kZSJ9.X4X3JWIaV7ju9sBLZgDpHA";

  map = new mapboxgl.Map({
    container: "map", // ID of the div in foreignObject
    style: "mapbox://styles/mapbox/dark-v11",
    center: [-74.006, 40.7128], // [lng, lat] of NYC
    zoom: 12,
  });

  // Prepare GeoJSON points from mapDataset
  const geojson = {
    type: "FeatureCollection",
    features: mapDataset.map((point) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [point.long, point.lat],
      },
      properties: {
        date: point.issue_dt,
        plate_id: point.plate_id,
        issue_dt_ts: point.issue_dt, // Add timestamp for filtering
      },
    })),
  };

  function adjustMapBounds(selectedPlateID) {
    // Retrieve the GeoJSON data from the source
    const sourceData = map.getSource("filtered-points")._data;

    const filteredPoints = sourceData.features.filter(
      (feature) => feature.properties.plate_id === selectedPlateID
    );

    // Extract all coordinates of the filtered points
    const coordinates = filteredPoints.map(
      (feature) => feature.geometry.coordinates
    );

    // Calculate the bounding box
    const bounds = new mapboxgl.LngLatBounds();

    coordinates.forEach((coord) => {
      bounds.extend(coord);
    });

    // Fit the map to the calculated bounds with padding
    map.fitBounds(bounds, {
      padding: 100, // Adjust padding as needed
      duration: 1000, // Duration in milliseconds for the animation
      essential: true, // This ensures the animation is not affected by user preferences
    });

    AnimationController.start();
  }

  // Function to load borough boundaries
  async function loadBoroughs() {
    console.log("boroughs");
    const response = await fetch("data/raw/Borough Boundaries.geojson");
    if (!response.ok) {
      throw new Error("Failed to load borough boundaries.");
    }
    const data = await response.json();
    return data;
  }

  // Function to filter points within boroughs using Turf.js
  function filterPointsWithinBoroughs(points, boroughs) {
    const filtered = {
      type: "FeatureCollection",
      features: [],
    };

    points.features.forEach((point) => {
      // Check if the point is within any borough
      const isInside = boroughs.features.some((borough) =>
        turf.booleanPointInPolygon(point, borough)
      );
      if (isInside) {
        filtered.features.push(point);
      }
    });

    return filtered;
  }

  // Animation Controller Object
  const AnimationController = (function () {
    let currentIndex = 0;
    let isPaused = false;
    let timeoutId = null;

    // Define speeds
    const animationSpeed = 100; // 100 ms per date

    // Function to add a point and update the map
    function addPoints(currentDate) {
      const formattedDate = currentDate.toISOString().split("T")[0];

      map.setFilter("filtered-points-layer", [
        "all",
        ["==", ["get", "plate_id"], selectedPlateID],
        ["<=", ["get", "issue_dt_ts"], formattedDate],
      ]);

      // Query features that match the current date and selectedPlateID
      const matchingFeatures = map.querySourceFeatures("filtered-points", {
        filter: [
          "all",
          ["==", ["get", "plate_id"], selectedPlateID],
          ["==", ["get", "issue_dt_ts"], formattedDate],
        ],
      });

      // Highlight each matching feature
      matchingFeatures.forEach((feature) => {
        map.setFeatureState({ source: "filtered-points" }, { highlight: true });
      });

      // After a delay, remove the highlight to transition back to normal size
      setTimeout(() => {
        matchingFeatures.forEach((feature) => {
          map.setFeatureState(
            { source: "filtered-points" },
            { highlight: false }
          );
        });
      }, 1000); // Match this duration to 'circle-radius-transition.duration'

      d3.select("#map").select("#date-display").text(`Date: ${formattedDate}`);
    }

    // Function to iterate through all dates
    function iterateDates() {
      if (currentIndex >= selectedPlateDates.length) {
        // Stop the animation when all dates have been processed
        return;
      }

      const currentDate = selectedPlateDates[currentIndex];
      const formattedDate = currentDate.toISOString().split("T")[0];

      // Add points if any
      addPoints(currentDate);
      currentIndex++;

      // Schedule the next iteration
      timeoutId = setTimeout(() => {
        if (!isPaused) {
          iterateDates();
        }
      }, animationSpeed);
    }

    // Public methods
    return {
      start: function () {
        selectedPlateDates = [
          ...mapDataset
            .filter((d) => d.plate_id == selectedPlateID)
            .map((d) => d.issue_dt),
        ];

        currentIndex = 0;
        iterateDates(selectedPlateDates);
      },
      pause: function () {
        isPaused = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      },
      resume: function () {
        if (!isPaused) return;
        isPaused = false;
        iterateDates();
      },
    };
  })();

  // Add source and layer for points when the map loads
  map.on("load", async () => {
    // Load borough boundaries
    const boroughsData = await loadBoroughs();

    // Filter points within boroughs
    const filteredGeojson = filterPointsWithinBoroughs(geojson, boroughsData);

    // Check if there are any points after filtering
    if (filteredGeojson.features.length === 0) {
      console.warn("No points found within the five boroughs.");
      return;
    }

    // Add the filtered points as a source
    map.addSource("filtered-points", {
      type: "geojson",
      data: filteredGeojson,
    });

    map.addLayer({
      id: "filtered-points-layer",
      type: "circle",
      source: "filtered-points",
      paint: {
        "circle-radius": [
          "case",
          ["boolean", ["feature-state", "highlight"], false],
          12, // Radius when highlighted
          6, // Normal radius
        ],
        "circle-color": "#007cbf",
        "circle-opacity": 0.8,
        "circle-radius-transition": {
          duration: 1000, // Transition duration in milliseconds
          delay: 0,
          type: "linear",
        },
      },
    });

    // Initialize a single popup instance
    const popup = new mapboxgl.Popup({
      closeButton: false, // Removes the close button
      closeOnClick: false, // Keeps the popup open until mouse leaves
    });

    // Add event listeners for hover interaction
    map.on("mouseenter", "filtered-points-layer", (e) => {
      // Change the cursor style to pointer
      map.getCanvas().style.cursor = "pointer";

      // Get the coordinates of the point
      const coordinates = e.features[0].geometry.coordinates.slice();

      // Get the properties of the point
      const props = e.features[0].properties;

      // Construct the HTML content for the popup
      // Customize this based on the properties you have
      const popupContent = `
        <div style="font-size: 12px;">
          <strong>Date:</strong> ${new Date(props.date).toDateString()}<br/>
        </div>
      `;

      // Ensure the popup appears above the point even if the map is moved
      while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
        coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
      }

      // Set the popup's location and content, then add it to the map
      popup.setLngLat(coordinates).setHTML(popupContent).addTo(map);
    });

    map.on("mouseleave", "filtered-points-layer", () => {
      // Reset the cursor style
      map.getCanvas().style.cursor = "";

      // Remove the popup
      popup.remove();
    });

    map.setFilter("filtered-points-layer", [
      "==",
      ["get", "plate_id"],
      selectedPlateID,
    ]);

    adjustMapBounds(selectedPlateID);

    // Start the animation
    // AnimationController.start();
  });

  // Add navigation controls (optional)
  map.addControl(new mapboxgl.NavigationControl());
}

// Array of all the graph functions
// Will be called from the scroller functionality

let activationFunctions = [
  () => {
    drawHist();
    hideMap();
  },
  () => {
    drawHist(50, 100);
    hideMap();
  },
  () => {
    drawHist(95, 100);
    hideImage();
    hideMap();
  },
  () => {
    showImage();
    cleanHist();
    hideMap();
  },
  () => {
    drawMapbox();
    hideImage();
  }, // Newly added Mapbox function
];

// All the scrolling functions
// Will draw a new graph based on the index provided by the scroll

let scroll = scroller().container(d3.select("#graphic"));
scroll();

let lastIndex,
  activeIndex = 0;

scroll.on("active", function (index) {
  // d3.selectAll(".step")
  //   .each(function (d, i) {
  //     d3.select(this).classed("z", i === index ? true : false);
  //   })
  //   .transition()
  //   .duration(500)

  //   .style("opacity", function (d, i) {
  //     return this.classList.contains("ghost") ? 0 : i === index ? 1 : 0.1;
  //   });

  activeIndex = index;

  // d3.select("#sections").classed("z", activeIndex % 2 !== 0);
  let sign = activeIndex - lastIndex < 0 ? -1 : 1;
  let scrolledSections = d3.range(lastIndex + sign, activeIndex + sign, sign);

  scrolledSections.forEach((i) => {
    console.log(i);
    activationFunctions[i]();
  });
  lastIndex = activeIndex;
});

// reload on top of page
history.scrollRestoration = "manual";
