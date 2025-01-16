let histDataset, mapDataset, mapPlates;
let svg, g;
let xLabel, yLabel;
let plates, selectedPlateDates;
let cumXScale, cumYScale, nodes;
let xAxis, yAxis;
let simulation;
let selectedPlateID = null;
let map, mapContainer; // Global map instance
let selectButton;
let DOT_ADJUSTMENT_FACTOR = 1;
let xTickCount, yTickCount;
let ADJ_WIDTH, ADJ_HEIGHT;
let showingHist = true;

const MARGIN = { LEFT: 100, RIGHT: 100, TOP: 50, BOTTOM: 20 };
let WIDTH = 800;
let HEIGHT = 500;
let HEIGHT_WIDTH_RATIO = HEIGHT / WIDTH;
const DOT = { RADIUS: 5, OPACITY: 0.5 };
const TICKS = { x: 50, y: 50 };
const BOROUGH_TEXT = { width_padding: 10, height_padding: 10 };

// change to boroughs eventually
const boroughCategories = {
  Brooklyn: [0.15, 40],
  Queens: [0.32, 35],
  Manhattan: [0.495, 3],
  Bronx: [0.665, 12],
  "Staten Island": [0.85, 10],
};

const boroughNames = Object.keys(boroughCategories);

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

function formatString(input) {
  if (!input) return ""; // Handle null or undefined inputs

  // Step 1: Replace all "@" with "&"
  let replacedStr = input.replace(/@/g, "&");

  // Step 2: Insert a space before and after each "&"
  // This ensures that "&" is surrounded by spaces
  // Use a regex to find "&" not already surrounded by spaces
  replacedStr = replacedStr.replace(/&(?=\S)/g, " & ");
  replacedStr = replacedStr.replace(/(?<=\S)&/g, " & ");

  // Step 3: Remove any extra whitespace by replacing multiple spaces with a single space
  replacedStr = replacedStr.replace(/\s+/g, " ").trim();

  // Step 4: Split the string into words using spaces as separators
  let words = replacedStr.split(" ");

  // Step 5: Iterate over each word to format them
  let formattedWords = words.map((word, index) => {
    if (index === 0 && word.length === 2 && word !== "ST") {
      // If it's the first word and has exactly two letters, capitalize both
      return word.toUpperCase();
    } else if (word.length > 0) {
      // Capitalize the first letter and make the rest lowercase
      // Do not alter "&"
      return word === "&"
        ? "&"
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    } else {
      // If the word is an empty string (shouldn't occur due to trimming), return it as is
      return word;
    }
  });

  // Step 6: Join the formatted words back into a single string with spaces
  return formattedWords.join(" ");
}

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

function tickCounts(width, height) {
  const x = Math.floor((width - MARGIN.LEFT - MARGIN.RIGHT) / TICKS.x);
  const y = Math.floor((height - MARGIN.TOP - MARGIN.BOTTOM) / TICKS.y);

  return [x, y];
}

// Function to update dimensions based on container size
function updateDimensions() {
  const container = document.getElementById("vis");
  const containerWidth = container.clientWidth;

  ADJ_WIDTH = Math.min(WIDTH, containerWidth);
  ADJ_HEIGHT = ADJ_WIDTH * HEIGHT_WIDTH_RATIO;

  DOT_ADJUSTMENT_FACTOR = ADJ_WIDTH / WIDTH;

  // Update scales
  cumXScale.range([MARGIN.LEFT, ADJ_WIDTH - MARGIN.RIGHT]);
  cumYScale.range([ADJ_HEIGHT - MARGIN.BOTTOM, MARGIN.TOP]);

  // Determine dynamic tick counts
  [xTickCount, yTickCount] = tickCounts(ADJ_WIDTH, ADJ_HEIGHT);

  // update axes
  xAxis.attr("transform", `translate(0,${ADJ_HEIGHT - MARGIN.BOTTOM})`).call(
    d3
      .axisBottom(cumXScale)
      .tickFormat((d) => `${d}%`)
      .ticks(xTickCount)
  );

  yAxis.call(
    d3
      .axisLeft(cumYScale)
      .tickFormat((d) => `${d}%`)
      .ticks(yTickCount)
  );

  positionLabels();

  // Update SVG size
  svg
    .attr("width", ADJ_WIDTH + MARGIN.LEFT + MARGIN.RIGHT)
    .attr("height", ADJ_HEIGHT + MARGIN.TOP + MARGIN.BOTTOM);

  simulation
    .force("forceX", d3.forceX((d) => cumXScale(d.row_pct)).strength(0.075))
    .force("forceY", d3.forceY((d) => cumYScale(d.cum_share)).strength(0.075));
  if (showingHist) {
    nodes
      .attr("cx", (d) => cumXScale(d.row_pct))
      .attr("cy", (d) => cumYScale(d.cum_share))
      .attr("r", DOT.RADIUS * DOT_ADJUSTMENT_FACTOR);
  } else {
    nodes.attr("r", DOT.RADIUS * DOT_ADJUSTMENT_FACTOR * 1.5);
    simulation
      .force("charge", d3.forceManyBody().strength(0.1))
      .force(
        "forceX",
        d3
          .forceX((d) => boroughCategories[d.violation_borough][0] * ADJ_WIDTH)
          .strength(0.1)
      )
      .force("forceY", d3.forceY(ADJ_HEIGHT / 2).strength(0.1))
      .force("collide", d3.forceCollide(ADJ_WIDTH / 80 / 1.2));

    simulation.alpha(0.9).restart();
  }

  // Update image positions if necessary
  svg
    .select(".embedded-image")
    .attr("x", ADJ_WIDTH / 2 - 50)
    .attr("y", ADJ_HEIGHT / 4)
    .attr("transform", `rotate(0, ${WIDTH / 2}, ${HEIGHT / 2})`);

  svg
    .select(".image-group foreignObject")
    .attr("x", ADJ_WIDTH / 2 - 100)
    .attr("y", ADJ_HEIGHT / 4 + 270);

  svg
    .select(".map-foreignobject")
    .attr("width", ADJ_WIDTH)
    .attr("height", ADJ_HEIGHT);

  // update label positions
  svg
    .selectAll(".borough-label")
    .attr(
      "transform",
      (d) =>
        `translate(${boroughCategories[d][0] * ADJ_WIDTH}, ${ADJ_HEIGHT / 1.3})`
    );

  svg.selectAll(".borough-label").each(function (d) {
    const g = d3.select(this);

    // Update text attributes (e.g., font size)
    g.select("text.label-text").attr(
      "font-size",
      `${12 * (ADJ_WIDTH / WIDTH)}px`
    ); // Example scaling

    // Update rectangle size based on updated text
    const text = g.select("text.label-text");
    const bbox = text.node().getBBox();

    g.select("rect.label-rect")
      .attr("x", bbox.x - BOROUGH_TEXT.width_padding * DOT_ADJUSTMENT_FACTOR)
      .attr("y", bbox.y - BOROUGH_TEXT.height_padding * DOT_ADJUSTMENT_FACTOR)
      .attr(
        "width",
        bbox.width + 2 * BOROUGH_TEXT.width_padding * DOT_ADJUSTMENT_FACTOR
      )
      .attr(
        "height",
        bbox.height + 2 * BOROUGH_TEXT.height_padding * DOT_ADJUSTMENT_FACTOR
      );
  });
}

// All the initial elements should be created in the drawInitial function
// As they are required, their attributes can be modified
// They can be shown or hidden using their 'opacity' attribute
// Each element should also have an associated class name for easy reference

function drawInitial() {
  const container = document.getElementById("vis");
  const containerWidth = container.clientWidth;

  ADJ_WIDTH = Math.min(WIDTH, containerWidth);
  ADJ_HEIGHT = ADJ_WIDTH * HEIGHT_WIDTH_RATIO;

  [xTickCount, yTickCount] = tickCounts(ADJ_WIDTH, ADJ_HEIGHT);

  DOT_ADJUSTMENT_FACTOR = ADJ_WIDTH / WIDTH;

  // axes
  cumXScale = d3
    .scaleLinear()
    .domain([0, 100])
    .range([MARGIN.LEFT, ADJ_WIDTH - MARGIN.RIGHT]);

  cumYScale = d3
    .scaleLinear()
    .domain([0, 100])
    .range([ADJ_HEIGHT - MARGIN.BOTTOM, MARGIN.TOP]);

  svg = d3
    .select("#vis")
    .append("svg")
    .attr("width", ADJ_WIDTH + MARGIN.LEFT + MARGIN.RIGHT)
    .attr("height", ADJ_HEIGHT + MARGIN.TOP + MARGIN.BOTTOM)
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
    .attr("transform", `translate(0,${ADJ_HEIGHT - MARGIN.BOTTOM})`);

  xAxis.call(
    d3
      .axisBottom(cumXScale)
      .tickFormat((d) => `${d}%`)
      .ticks(xTickCount)
  );

  yAxis = svg
    .append("g")
    .attr("class", "y-axis")
    .attr("transform", `translate(${MARGIN.LEFT},0)`);

  yAxis.call(
    d3
      .axisLeft(cumYScale)
      .tickFormat((d) => `${d}%`)
      .ticks(yTickCount)
  );

  // Instantiate the force simulation
  simulation = d3.forceSimulation(histDataset);

  // Selection of all the circles
  // Append a div element for the tooltip (hidden by default)
  const tooltip = d3.select("body").append("div").attr("class", "tooltip");

  // Create nodes
  nodes = svg
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
    .attr("r", DOT.RADIUS * DOT_ADJUSTMENT_FACTOR)
    .attr("opacity", DOT.OPACITY)
    .on("mouseover", function (event, d) {
      if (d3.select(this).attr("opacity") > 0) {
        // Show the tooltip
        tooltip
          .html(
            `<strong>Plate ID:</strong> ${d.plate_id}<br>
           <strong>Registration state:</strong> ${d.registration_state}
           <br>
           <strong>Main borough:</strong> ${d.violation_borough}
           <br>
           <strong>School zone violations:</strong> ${d.school_zone_violations}
           `
          )
          .style("left", `${event.pageX + 10}px`) // Position tooltip near the mouse
          .style("top", `${event.pageY + 10}px`)
          .classed("visible", true);

        // Optionally, highlight the node
        d3.select(this).classed("highlighted", true);
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
      d3.select(this).classed("highlighted", false);
    });

  // Define each tick of simulation
  simulation
    .on("tick", () => {
      nodes.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
    })
    // define forces
    .force("forceX", d3.forceX((d) => cumXScale(d.row_pct)).strength(0.075))
    .force("forceY", d3.forceY((d) => cumYScale(d.cum_share)).strength(0.075))
    .force(
      "collide",
      d3
        .forceCollide()
        .radius((d) => (DOT.RADIUS * DOT_ADJUSTMENT_FACTOR) / 2.5)
        .strength(0.7)
    );

  simulation.alpha(0.75).restart();

  // add labels for borough packs
  const boroughLabelsGroup = svg.append("g").attr("class", "borough-labels");

  boroughLabelsGroup
    .selectAll(".borough-label")
    .data(boroughNames)
    .enter()
    .append("g")
    .attr("class", "borough-label")
    .attr(
      "transform",
      (d) =>
        `translate(${boroughCategories[d][0] * ADJ_WIDTH}, ${ADJ_HEIGHT / 1.3})`
    )
    .each(function (d) {
      const g = d3.select(this);

      // Append text
      const text = g
        .append("text")
        .text(`${d} (${boroughCategories[d][1]}%)`)
        .attr("class", "label-text");

      // Get the bounding box of the text
      const bbox = text.node().getBBox();

      // Append rectangle behind the text
      g.insert("rect", "text")
        .attr("class", "label-rect")
        .attr("x", bbox.x - BOROUGH_TEXT.width_padding)
        .attr("y", bbox.y - BOROUGH_TEXT.height_padding)
        .attr("width", bbox.width + 2 * BOROUGH_TEXT.width_padding)
        .attr("height", bbox.height + 2 * BOROUGH_TEXT.height_padding);
    });

  // hide to start
  svg.selectAll("g.borough-labels").style("visibility", "hidden");

  // Append the Mapbox foreignObject, positioned to the right of the dropdown
  svg
    .append("foreignObject")
    .attr("width", ADJ_WIDTH)
    .attr("height", ADJ_HEIGHT)
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
    .attr("x", ADJ_WIDTH / 2 - 50) // Adjust x position
    .attr("y", ADJ_HEIGHT / 4) // Adjust y position
    .attr("width", 300) // Adjust width
    .attr("height", 300) // Adjust height
    .attr("class", "embedded-image") // Assign a class for styling
    // Initial rotation set to 0 degrees
    .attr("transform", `rotate(0, ${ADJ_WIDTH / 2}, ${ADJ_HEIGHT / 2})`);

  // Append the caption text beneath the image within the same group
  imageGroup
    .append("foreignObject")
    .attr("x", ADJ_WIDTH / 3) // Adjust x as needed
    .attr("y", ADJ_HEIGHT / 4) // Adjust y as needed
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

  // update dimensions on the jump
  updateDimensions();

  // Add window resize listener

  window.addEventListener("resize", updateDimensions);
}

// Function to show and rotate the image group
function showImage() {
  const imageGroup = d3.select(".image-group");

  imageGroup
    .transition()
    .duration(500) // Duration of the transition in milliseconds
    .style("opacity", 1); // Fade in the group
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

  [xTickCount, yTickCount] = tickCounts(ADJ_WIDTH, ADJ_HEIGHT);

  xAxis
    .transition()
    .duration(500)
    .call(
      d3
        .axisBottom(cumXScale)
        .tickFormat((d) => `${d}%`)
        .ticks(xTickCount)
    );
  yAxis
    .transition()
    .duration(500)
    .call(
      d3
        .axisLeft(cumYScale)
        .tickFormat((d) => `${d}%`)
        .ticks(yTickCount)
    );
}

function drawHist(xLower = 0, xHigher = 100) {
  showingHist = true;
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

  simulation
    .on("tick", () => {
      nodes.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
    })
    // define forces
    .force("forceX", d3.forceX((d) => cumXScale(d.row_pct)).strength(0.075))
    .force("forceY", d3.forceY((d) => cumYScale(d.cum_share)).strength(0.075))
    .force(
      "collide",
      d3
        .forceCollide()
        .radius((d) => (DOT.RADIUS * DOT_ADJUSTMENT_FACTOR) / 2.5)
        .strength(0.7)
    );

  simulation.alpha(2).restart();

  nodes
    .transition()
    .duration(500)
    .attr("cx", (d) => cumXScale(d.row_pct))
    .attr("cy", (d) => cumYScale(d.cum_share))
    .attr("r", DOT.RADIUS * DOT_ADJUSTMENT_FACTOR)
    .attr("opacity", (d) => (limitedData.includes(d) ? DOT.OPACITY : 0)); // Semi-transparent for others
}

function cleanHist(keepNodes = false) {
  const svg = d3.select("#vis").select("svg");

  svg.select(".x-label").style("display", "none");
  svg.select(".y-label").style("display", "none");

  svg.select(".x-axis").style("display", "none");
  svg.select(".y-axis").style("display", "none");

  if (!keepNodes) {
    svg.selectAll(".nodes").style("display", "none");
  }
}

function drawBoroughPacks() {
  // display nodes
  const svg = d3.select("#vis").select("svg");
  svg.selectAll(".nodes").style("display", "block");
  showingHist = false;

  simulation
    .force("charge", d3.forceManyBody().strength(0.1))
    .force(
      "forceX",
      d3.forceX((d) => boroughCategories[d.violation_borough][0] * ADJ_WIDTH)
    )
    .force(
      "forceY",
      d3.forceY((d) => ADJ_HEIGHT / 2)
    )
    .force("collide", d3.forceCollide(ADJ_WIDTH / 80))
    .alphaDecay(0.05);

  simulation.alpha(0.9).restart();

  nodes
    .transition()
    .duration(300)
    .attr("r", DOT.RADIUS * DOT_ADJUSTMENT_FACTOR * 1.5);

  simulation.alpha(0.9).restart();

  svg.selectAll("g.borough-labels").style("visibility", "visible");
}

function cleanBoroughPacks(keepNodes = false) {
  const svg = d3.select("#vis").select("svg");
  svg.selectAll("g.borough-labels").style("visibility", "hidden");

  if (!keepNodes) {
    svg.selectAll(".nodes").style("display", "none");
  }
}

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
    style: "mapbox://styles/mapbox/light-v11",
    center: [-74.006, 40.7128], // [lng, lat] of NYC
    zoom: 12,
    attributionControl: false,
  });

  // Prepare GeoJSON points from mapDataset
  const geojson = {
    type: "FeatureCollection",
    features: mapDataset.map((point, index) => ({
      type: "Feature",
      id: index, // Assign a unique ID using the index
      geometry: {
        type: "Point",
        coordinates: [point.long, point.lat],
      },
      properties: {
        date: point.issue_dt,
        location:
          point.street_name +
          " " +
          point.intersecting_street +
          " " +
          point.violation_county,
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
    const animationSpeed = 5000; // 5 seconds per plate

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
      }, animationSpeed / selectedPlateDates.length);
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
          ["boolean", ["feature-state", "hover"], false],
          10, // Radius when hovered
          6, // Normal radius
        ],
        "circle-color": "#007cbf",
        "circle-opacity": 0.8,
      },
    });

    // Initialize a single popup instance
    const popup = new mapboxgl.Popup({
      closeButton: false, // Removes the close button
      closeOnClick: false, // Keeps the popup open until mouse leaves
    });

    // Initialize a variable to keep track of the currently hovered feature
    let featureId = null;
    // Add event listeners for hover interaction
    map.on("mouseenter", "filtered-points-layer", (e) => {
      // Change the cursor style to pointer
      map.getCanvas().style.cursor = "pointer";

      // Get the feature ID
      featureId = e.features[0].id;

      // set hover state
      map.setFeatureState(
        { source: "filtered-points", id: featureId },
        { hover: true }
      );

      // Get the coordinates of the point
      const coordinates = e.features[0].geometry.coordinates.slice();

      // Get the properties of the point
      const props = e.features[0].properties;

      // Construct the HTML content for the popup
      // Customize this based on the properties you have
      const popupContent = `
        <div class = "map-popup">
          <strong>Date:</strong> ${new Date(props.date).toDateString()} <br>
          <strong>Location:</strong> ${formatString(props.location)} 
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
      if (featureId !== null) {
        // Reset the hover state
        map.setFeatureState(
          { source: "filtered-points", id: featureId },
          { hover: false }
        );
      }
      featureId = null;

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
  () => {
    drawHist();
    hideMap();
  },
  () => {
    drawHist(50.5, 100);
    hideMap();
  },
  () => {
    drawHist(99, 100);
    hideMap();
    cleanBoroughPacks(true);
  },
  () => {
    cleanHist(true);
    hideImage();
    drawBoroughPacks();
  },
  () => {
    // a bit hacky, but need to include these hist functions to get draw borough packs
    // to behave consistently on up/down scrolls
    drawHist(99, 100);
    cleanHist(true);
    cleanBoroughPacks();
    showImage();
    hideMap();
  },
  () => {
    drawMapbox();
    hideImage();
  },
];

// scroll
let scroll = scroller().container(d3.select("#graphic"));
scroll();
let lastIndex,
  activeIndex = 0;
scroll.on("active", function (index) {
  activeIndex = index;

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
