let histDataset, mapDataset, mapPlates, svg, g, plates;
let cumXScale, cumYScale;
let xAxis, yAxis;
let simulation;
let selectedPlateID = null;
let map; // Global map instance

const MARGIN = { LEFT: 100, RIGHT: 100, TOP: 20, BOTTOM: 20 };
const WIDTH = 800;
const HEIGHT = 500;

const DOT = { RADIUS: 5, OPACITY: 0.2 };

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
  });

  mapDataset = data.filter((d) => d.lat != 0 && d.long != 0);
  mapPlates = [...new Set(data.map((d) => d.plate_id))];
});

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
  const xLabel = svg
    .append("text")
    .attr("class", "x-label")
    .attr("y", HEIGHT + 20)
    .attr("x", WIDTH / 2)
    .attr("font-size", "20px")
    .attr("text-anchor", "middle")
    .text("Share of drivers");

  const yLabel = svg
    .append("text")
    .attr("class", "y-label")
    .attr("transform", "rotate(-90)")
    .attr("y", MARGIN.LEFT - 30)
    .attr("x", -250)
    .attr("font-size", "20px")
    .attr("text-anchor", "middle")
    .text("Share of school zone violations");

  xAxis = svg
    .append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${HEIGHT - MARGIN.BOTTOM})`);

  xAxis.call(d3.axisBottom(cumXScale));

  yAxis = svg
    .append("g")
    .attr("class", "y-axis")
    .attr("transform", `translate(${MARGIN.LEFT},0)`);

  yAxis.call(d3.axisLeft(cumYScale));

  // Instantiate the force simulation
  simulation = d3.forceSimulation(histDataset);

  // Define each tick of simulation
  simulation.on("tick", () => {
    nodes.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
  });

  // Selection of all the circles
  // Append a div element for the tooltip (hidden by default)
  const tooltip = d3
    .select("body")
    .append("div")
    .style("position", "absolute")
    .style("background-color", "white")
    .style("border", "1px solid #ccc")
    .style("padding", "5px")
    .style("border-radius", "5px")
    .style("box-shadow", "0px 2px 5px rgba(0, 0, 0, 0.3)")
    .style("pointer-events", "none")
    .style("opacity", 0); // Initially hidden

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
          .style("opacity", 1)
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
          .style("top", `${event.pageY + 10}px`);

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
      tooltip.style("opacity", 0);

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
    .attr("y", 0)
    .attr("class", "map-foreignobject")
    .style("display", "none") // Hidden by default
    .append("xhtml:div")
    .attr("id", "map"); // This div will host the Mapbox map

  // add the options to the button
  d3.select("#selectButton")
    .selectAll("option")
    .data(mapPlates)
    .enter()
    .append("option")
    .text((d) => d)
    .attr("value", (d) => d);

  // dropdown will be initialized to first element
  selectedPlateID = mapPlates[0];

  // When the button is changed, run the updateChart function
  d3.select("#selectButton").on("change", function (d) {
    // recover the option that has been chosen
    selectedPlateID = d3.select(this).property("value");
    // Apply filter to show only points with the selected plate_id
    map.setFilter("filtered-points-layer", [
      "==",
      ["get", "plate_id"],
      selectedPlateID,
    ]);

    adjustMapBounds(selectedPlateID);

    console.log(selectedPlateID);
  });
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

  xAxis.transition().duration(500).call(d3.axisBottom(cumXScale));
  yAxis.transition().duration(500).call(d3.axisLeft(cumYScale));
}

function drawHist(xLower = 0, xHigher = 100) {
  const svg = d3.select("#vis").select("svg");

  svg.select(".x-label").style("display", "block");
  svg.select(".y-label").style("display", "block");

  svg.select(".x-axis").style("display", "block");
  svg.select(".y-axis").style("display", "block");

  svg.selectAll(".nodes").style("display", "block");

  // remove map...
  svg.select(".map-foreignobject").style("display", "none");
  d3.select("#selectButton").classed("hidden", true);

  // Filter the histDataset to include only a subset of nodes
  const limitedData = histDataset.filter((d) => {
    return d.row_pct >= xLower && d.row_pct <= xHigher;
  });

  // Regenerate axes based on the limited data
  regenerateAxes(limitedData);

  // Bind all existing nodes to the full histDataset (don't remove any nodes)
  const nodes = svg.selectAll(".nodes").data(histDataset, (d) => d.plate_id);

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
    padding: 50, // Adjust padding as needed
    maxZoom: 14, // Optional: Limit maximum zoom to prevent over-zooming
    duration: 1000, // Duration in milliseconds for the animation
    essential: true, // This ensures the animation is not affected by user preferences
  });
}

// Function to draw the Mapbox map (as defined earlier)

// Insert the drawMapbox function here or in another script tag
// For clarity, include it here again:

function drawMapbox() {
  cleanHist();
  // Show the foreignObject containing the map
  d3.select(".map-foreignobject").style("display", "block");
  d3.select("#selectButton").classed("hidden", false);

  // Ensure the SVG remains visible
  d3.select("svg").style("opacity", 1);

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
      },
    })),
  };

  // Function to load borough boundaries
  async function loadBoroughs() {
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
        "circle-radius": 6,
        "circle-color": "#007cbf",
        "circle-opacity": 0.8,
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
          <strong>Date:</strong> ${props.date}<br/>
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
  });

  // Add navigation controls (optional)
  map.addControl(new mapboxgl.NavigationControl());
}

// Array of all the graph functions
// Will be called from the scroller functionality

let activationFunctions = [
  drawHist,
  () => drawHist(50, 100),
  () => drawHist(95, 100),
  drawMapbox, // Newly added Mapbox function
];

// All the scrolling functions
// Will draw a new graph based on the index provided by the scroll

let scroll = scroller().container(d3.select("#graphic"));
scroll();

let lastIndex,
  activeIndex = 0;

scroll.on("active", function (index) {
  d3.selectAll(".step")
    .transition()
    .duration(500)
    .style("opacity", function (d, i) {
      return i === index ? 1 : 0.1;
    });

  activeIndex = index;
  let sign = activeIndex - lastIndex < 0 ? -1 : 1;
  let scrolledSections = d3.range(lastIndex + sign, activeIndex + sign, sign);
  scrolledSections.forEach((i) => {
    console.log(i);
    activationFunctions[i]();
  });
  lastIndex = activeIndex;
});

scroll.on("progress", function (index, progress) {
  if ((index == 2) & (progress > 0.7)) {
    // Any specific interactions during scroll progress
  }
});
