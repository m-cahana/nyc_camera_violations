let distDataset, mapDataset, mapPlates;
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

let CORE_MARGIN = { LEFT: 150, RIGHT: 100, TOP: 50, BOTTOM: 20 };
let MARGIN = { LEFT: 150, RIGHT: 100, TOP: 50, BOTTOM: 20 };
let WIDTH = 800;
let HEIGHT = 500;
let HEIGHT_WIDTH_RATIO = HEIGHT / WIDTH;
const DOT = { RADIUS: 5, OPACITY: 0.5 };
const TICKS = { x: 50, y: 50 };
const BOROUGH_TEXT = { width_padding: 10, height_padding: 10 };
const IMAGE = { WIDTH: 600, HEIGHT: 400, MARGIN: 15 };
const IMAGE_2 = { WIDTH: 400, HEIGHT: 600, MARGIN: 15 };

const boroughCategories = {
  Brooklyn: [0.15, 40],
  Queens: [0.32, 35],
  Manhattan: [0.495, 3],
  Bronx: [0.665, 12],
  "Staten Island": [0.85, 10],
};

const boroughNames = Object.keys(boroughCategories);

import { scroller } from "./scroller.js";

// *******************
// read data
// *******************
d3.csv("data/processed/school_zone_violations_sparser.csv").then((data) => {
  data.forEach((d) => {
    d.row_pct = Number(d.row_pct * 100);
    d.fines = Number(d.fines);
    d.cum_share = Number(d.cum_share * 100);
    d.school_zone_violations = Number(d.school_zone_violations);
  });

  distDataset = data;
  plates = distDataset.map((d) => d.plate_id);

  setTimeout(drawInitial, 100);
});

d3.csv("data/processed/repeat_offenders_lat_long_sample.csv").then((data) => {
  data.forEach((d) => {
    d.lat = Number(d.lat);
    d.long = Number(d.long);
    d.issue_dt = new Date(d.issue_dt);
  });

  // vilter out entries with invalid coordinates
  mapDataset = data.filter((d) => d.lat != 0 && d.long != 0);

  // extract unique plate_ids
  const uniquePlates = Array.from(new Set(data.map((d) => d.plate_id)));

  // Ensure "HSD2664" is at the top
  mapPlates = ["HSD2664", ...uniquePlates.filter((id) => id !== "HSD2664")];

  mapDataset.sort((a, b) => a.issue_dt - b.issue_dt);
});

// *******************
// functions
// *******************

// function to format string
export function formatString(input) {
  if (!input) return ""; // Handle null or undefined inputs

  // replace all "@" with "&"
  let replacedStr = input.replace(/@/g, "&");

  // insert a space before and after each "&"
  // this ensures that "&" is surrounded by spaces
  // use a regex to find "&" not already surrounded by spaces
  replacedStr = replacedStr.replace(/&(?=\S)/g, " & ");
  replacedStr = replacedStr.replace(/(?<=\S)&/g, " & ");

  // remove any extra whitespace by replacing multiple spaces with a single space
  replacedStr = replacedStr.replace(/\s+/g, " ").trim();

  // split the string into words using spaces as separators
  let words = replacedStr.split(" ");

  // iterate over each word to format them
  let formattedWords = words.map((word, index) => {
    if (index === 0 && word.length === 2 && word !== "ST") {
      // if it's the first word and has exactly two letters, capitalize both
      return word.toUpperCase();
    } else if (word.length > 0) {
      // capitalize the first letter and make the rest lowercase
      // do not alter "&"
      return word === "&"
        ? "&"
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    } else {
      // if the word is an empty string (shouldn't occur due to trimming), return it as is
      return word;
    }
  });

  // join the formatted words back into a single string with spaces
  return formattedWords.join(" ");
}

// function to position the labels dynamically
function positionLabels() {
  // calculate current width and height from scales
  const currentWidth = cumXScale.range()[1] - cumXScale.range()[0];
  const currentHeight = cumYScale.range()[0] - cumYScale.range()[1];

  // position X Label: centered horizontally, slightly below the X axis
  xLabel
    .attr("x", (cumXScale.range()[0] + cumXScale.range()[1]) / 2)
    .attr("y", cumYScale.range()[0] + 30)
    .attr("dy", "0.71em");

  // position Y Label: centered vertically, slightly left of the Y axis
  yLabel
    .attr("x", -(cumYScale.range()[0] + cumYScale.range()[1]) / 2)
    .attr("y", MARGIN.LEFT - 50)
    .attr("dy", "0.71em");
}

// dynamically estimate nunmber of ticks to show
function tickCounts(width, height) {
  const x = Math.floor((width - MARGIN.LEFT - MARGIN.RIGHT) / TICKS.x);
  const y = Math.floor((height - MARGIN.TOP - MARGIN.BOTTOM) / TICKS.y);

  return [x, y];
}

// function to update dimensions based on container size
function updateDimensions() {
  const container = document.getElementById("vis");
  const containerWidth = container.clientWidth;

  ADJ_WIDTH = Math.min(WIDTH, containerWidth);
  ADJ_HEIGHT = ADJ_WIDTH * HEIGHT_WIDTH_RATIO;

  DOT_ADJUSTMENT_FACTOR = ADJ_WIDTH / WIDTH;

  MARGIN = Object.keys(CORE_MARGIN).reduce((acc, key) => {
    acc[key] = CORE_MARGIN[key] * DOT_ADJUSTMENT_FACTOR;
    return acc;
  }, {});

  // update scales
  cumXScale.range([MARGIN.LEFT, ADJ_WIDTH - MARGIN.RIGHT]);
  cumYScale.range([ADJ_HEIGHT - MARGIN.BOTTOM, MARGIN.TOP]);

  // determine dynamic tick counts
  [xTickCount, yTickCount] = tickCounts(ADJ_WIDTH, ADJ_HEIGHT);

  // update axes
  xAxis.attr("transform", `translate(0,${ADJ_HEIGHT - MARGIN.BOTTOM})`).call(
    d3
      .axisBottom(cumXScale)
      .tickFormat((d) => `${d}%`)
      .ticks(xTickCount)
  );

  yAxis.attr("transform", `translate(${MARGIN.LEFT},0)`).call(
    d3
      .axisLeft(cumYScale)
      .tickFormat((d) => `${d}%`)
      .ticks(yTickCount)
  );

  positionLabels();

  // update SVG size
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

  // update image positions if necessary
  const centerX = ADJ_WIDTH / 2;
  const centerY = ADJ_HEIGHT / 2;

  // Update first image
  const image = svg.select(".centered-image");
  image
    .attr("x", centerX - (IMAGE.WIDTH * DOT_ADJUSTMENT_FACTOR) / 2)
    .attr("y", centerY - (IMAGE.HEIGHT * DOT_ADJUSTMENT_FACTOR) / 2)
    .attr("width", IMAGE.WIDTH * DOT_ADJUSTMENT_FACTOR)
    .attr("height", IMAGE.HEIGHT * DOT_ADJUSTMENT_FACTOR);

  // Update second image
  const image2 = svg.select(".centered-image-2");
  image2
    .attr("x", centerX - (IMAGE_2.WIDTH * DOT_ADJUSTMENT_FACTOR) / 2)
    .attr("y", centerY - (IMAGE_2.HEIGHT * DOT_ADJUSTMENT_FACTOR) / 2)
    .attr("width", IMAGE_2.WIDTH * DOT_ADJUSTMENT_FACTOR)
    .attr("height", IMAGE_2.HEIGHT * DOT_ADJUSTMENT_FACTOR);

  svg
    .select(".image-caption")
    .attr("x", ADJ_WIDTH / 2)
    .attr(
      "y",
      centerY + (IMAGE.HEIGHT * DOT_ADJUSTMENT_FACTOR) / 2 + IMAGE.MARGIN
    )
    .selectAll("tspan")
    .attr("x", ADJ_WIDTH / 2);

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

    // update text attributes (e.g., font size)
    g.select("text.label-text").attr(
      "font-size",
      `${12 * (ADJ_WIDTH / WIDTH)}px`
    );

    // update rectangle size based on updated text
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

// draw each visual initially, then hide most of them
function drawInitial() {
  const container = document.getElementById("vis");
  const containerWidth = container.clientWidth;

  ADJ_WIDTH = Math.min(WIDTH, containerWidth);
  ADJ_HEIGHT = ADJ_WIDTH * HEIGHT_WIDTH_RATIO;

  [xTickCount, yTickCount] = tickCounts(ADJ_WIDTH, ADJ_HEIGHT);

  DOT_ADJUSTMENT_FACTOR = ADJ_WIDTH / WIDTH;

  MARGIN = Object.keys(CORE_MARGIN).reduce((acc, key) => {
    acc[key] = CORE_MARGIN[key] * DOT_ADJUSTMENT_FACTOR;
    return acc;
  }, {});

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

  // instantiate the force simulation
  simulation = d3.forceSimulation(distDataset);

  // append a div element for the tooltip (hidden by default)
  const tooltip = d3.select("body").append("div").attr("class", "tooltip");

  // create nodes
  nodes = svg
    .selectAll("circle")
    .data(distDataset)
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
        // show the tooltip
        tooltip
          .html(
            `<strong>Plate ID:</strong> ${d.plate_id}<br>
           <strong>Registration state:</strong> ${d.registration_state}
           <br>
           <strong>Main borough:</strong> ${d.violation_borough}
           <br>
           <strong>School zone violations:</strong> ${d.school_zone_violations}
           <br>
           <strong>Total fines:</strong> $${d.fines.toLocaleString()}
           `
          )
          .style("left", `${event.pageX + 10}px`) // position tooltip near the mouse
          .style("top", `${event.pageY + 10}px`)
          .classed("visible", true);

        // highlight the node
        d3.select(this).classed("highlighted", true);
      }
    })
    .on("mousemove", function (event) {
      // update tooltip position as the mouse moves
      tooltip
        .style("left", `${event.pageX + 10}px`)
        .style("top", `${event.pageY + 10}px`);
    })
    .on("mouseout", function () {
      // hide the tooltip when mouse moves away
      tooltip.classed("visible", false);

      // remove highlight
      d3.select(this).classed("highlighted", false);
    });

  // define each tick of simulation
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

      // append text
      const text = g
        .append("text")
        .text(`${d} (${boroughCategories[d][1]}%)`)
        .attr("class", "label-text");

      // get the bounding box of the text
      const bbox = text.node().getBBox();

      // append rectangle behind the text
      g.insert("rect", "text")
        .attr("class", "label-rect")
        .attr("x", bbox.x - BOROUGH_TEXT.width_padding)
        .attr("y", bbox.y - BOROUGH_TEXT.height_padding)
        .attr("width", bbox.width + 2 * BOROUGH_TEXT.width_padding)
        .attr("height", bbox.height + 2 * BOROUGH_TEXT.height_padding);
    });

  // hide to start
  svg.selectAll("g.borough-labels").style("visibility", "hidden");

  // append the mapbox foreignObject
  svg
    .append("foreignObject")
    .attr("width", ADJ_WIDTH)
    .attr("height", ADJ_HEIGHT)
    .attr("x", 0)
    .attr("y", MARGIN.TOP)
    .attr("class", "map-foreignobject")
    .style("display", "none") // hidden by default
    .append("xhtml:div")
    .attr("id", "map"); // this div will host the Mapbox map

  mapContainer = d3.select("#map");

  mapContainer
    .append("div")
    .attr("id", "date-display")
    .style("position", "absolute");

  const selectWrapper = mapContainer.append("div").attr("id", "select-wrapper");

  // append a label for the selectButton
  selectWrapper
    .append("label")
    .attr("for", "selectButton")
    .text("Plate ID: ")
    .style("margin-right", "5px")

    .style("color", "#333");

  // append the select element to the wrapper
  selectButton = selectWrapper
    .append("select")
    .attr("id", "selectButton")
    .style("width", "200px");

  // add options to the selectButton
  selectButton
    .selectAll("option")
    .data(mapPlates)
    .enter()
    .append("option")
    .text((d) => d)
    .attr("value", (d) => d);

  // dropdown will be initialized to first element
  selectedPlateID = mapPlates[0];

  // add image
  const imageX = (ADJ_WIDTH - IMAGE.WIDTH * DOT_ADJUSTMENT_FACTOR) / 2;
  const imageY = (ADJ_HEIGHT - IMAGE.HEIGHT * DOT_ADJUSTMENT_FACTOR) / 2;

  const centerX = imageX + (IMAGE.WIDTH * DOT_ADJUSTMENT_FACTOR) / 2;
  const captionY = imageY + IMAGE.HEIGHT * DOT_ADJUSTMENT_FACTOR + IMAGE.MARGIN;

  svg
    .append("image")
    .attr("class", "centered-image")
    .attr("href", "images/crash-car-1.png")
    .attr("x", imageX)
    .attr("y", imageY)
    .attr("width", IMAGE.WIDTH * DOT_ADJUSTMENT_FACTOR)
    .attr("height", IMAGE.HEIGHT * DOT_ADJUSTMENT_FACTOR)
    .attr("opacity", 0);

  const caption = svg
    .append("text")
    .attr("class", "image-caption")
    .attr("text-anchor", "middle")
    .attr("x", centerX)
    .attr("y", captionY)
    .attr("opacity", 0); // start hidden

  // append first line of caption
  caption
    .append("tspan")
    .attr("x", ADJ_WIDTH / 2)
    .attr("dy", "0em")
    .text("Top offender crash in Fort Greene, Brooklyn, in 2021");

  // append second line of caption
  caption
    .append("tspan")
    .attr("x", ADJ_WIDTH / 2)
    .attr("dy", "1.2em")
    .text("Photo by Liam Quiqley");

  // Calculate center position for image
  const centerX2 = ADJ_WIDTH / 2;
  const centerY2 = ADJ_HEIGHT / 2;

  svg
    .append("image")
    .attr("class", "centered-image-2")
    .attr("href", "images/dvap.png")
    .attr("x", centerX2 - (IMAGE_2.WIDTH * DOT_ADJUSTMENT_FACTOR) / 2) // Center horizontally
    .attr("y", centerY2 - (IMAGE_2.HEIGHT * DOT_ADJUSTMENT_FACTOR) / 2) // Center vertically
    .attr("width", IMAGE_2.WIDTH * DOT_ADJUSTMENT_FACTOR)
    .attr("height", IMAGE_2.HEIGHT * DOT_ADJUSTMENT_FACTOR)
    .attr("opacity", 0);

  // update dimensions on the jump
  updateDimensions();

  // Add window resize listener
  window.addEventListener("resize", updateDimensions);
}

// function to display image
function showImage(image_class, caption_class) {
  console.log(image_class, caption_class);
  const svg = d3.select("#vis").select("svg");
  svg.selectAll(image_class).transition().duration(250).attr("opacity", 1);

  svg.select(caption_class).transition().duration(500).attr("opacity", 1);
}

// Function to hide and reset the image group
function hideImage(image_class, caption_class) {
  const svg = d3.select("#vis").select("svg");
  svg.selectAll(image_class).transition().duration(250).attr("opacity", 0);

  svg.select(caption_class).transition().duration(500).attr("opacity", 0);
}

function hideMap() {
  svg.select(".map-foreignobject").style("display", "none");
}

function regenerateAxes(data, nodes) {
  // calculate the maximum values in `limitedData`
  const minRowPct = d3.min(data, (d) => d.row_pct);
  const minCumShare = d3.min(data, (d) => d.cum_share);

  const maxRowPct = Math.ceil(d3.max(data, (d) => d.row_pct) / 5) * 5;
  const maxCumShare = Math.ceil(d3.max(data, (d) => d.cum_share) / 5) * 5;

  // update scales to reflect the new maximum values
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

// function to draw cumulative distribution
function drawCumDist(xLower = 0, xHigher = 100) {
  showingHist = true;
  const svg = d3.select("#vis").select("svg");

  svg.select(".x-label").style("display", "block");
  svg.select(".y-label").style("display", "block");

  svg.select(".x-axis").style("display", "block");
  svg.select(".y-axis").style("display", "block");

  svg.selectAll(".nodes").style("display", "block");

  // filter the distDataset to include only a subset of nodes
  const limitedData = distDataset.filter((d) => {
    return d.row_pct >= xLower && d.row_pct <= xHigher;
  });

  // regenerate axes based on the limited data
  regenerateAxes(limitedData);

  simulation
    .on("tick", () => {
      nodes.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
    })
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

// function to clean up cumulative distribution plot
function cleanCumDist(keepNodes = false) {
  const svg = d3.select("#vis").select("svg");

  svg.select(".x-label").style("display", "none");
  svg.select(".y-label").style("display", "none");

  svg.select(".x-axis").style("display", "none");
  svg.select(".y-axis").style("display", "none");

  if (!keepNodes) {
    svg.selectAll(".nodes").style("display", "none");
  }
}

// draw packs of nodes by borough
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

// clean packs of nodes by borough
function cleanBoroughPacks(keepNodes = false) {
  const svg = d3.select("#vis").select("svg");
  svg.selectAll("g.borough-labels").style("visibility", "hidden");

  if (!keepNodes) {
    svg.selectAll(".nodes").style("display", "none");
  }
}

// draw map
function drawMapbox() {
  // show the foreignObject containing the map
  d3.select(".map-foreignobject").style("display", "block");
  // ensure the SVG remains visible
  d3.select("svg").style("opacity", 1);

  selectButton = d3.select("#map").select("#selectButton");

  // event listener for selectButton
  selectButton.on("change", function () {
    selectedPlateID = d3.select(this).property("value");
    adjustMapBounds(selectedPlateID);
  });

  // initialize the Mapbox map
  mapboxgl.accessToken =
    "pk.eyJ1IjoibWljaGFlbC1jYWhhbmEiLCJhIjoiY201ZnhkcG05MDJleTJscHhhNm15MG1kZSJ9.X4X3JWIaV7ju9sBLZgDpHA";

  map = new mapboxgl.Map({
    container: "map", // ID of the div in foreignObject
    style: "mapbox://styles/mapbox/light-v11",
    center: [-74.006, 40.7128], // [lng, lat] of NYC
    zoom: 12 * DOT_ADJUSTMENT_FACTOR, // zoom level
    attributionControl: false,
  });

  // prepare GeoJSON points from mapDataset
  const geojson = {
    type: "FeatureCollection",
    features: mapDataset.map((point, index) => ({
      type: "Feature",
      id: index,
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
        issue_dt_ts: point.issue_dt,
      },
    })),
  };

  function adjustMapBounds(selectedPlateID) {
    // retrieve the GeoJSON data from the source
    const sourceData = map.getSource("filtered-points")._data;

    const filteredPoints = sourceData.features.filter(
      (feature) => feature.properties.plate_id === selectedPlateID
    );

    // extract all coordinates of the filtered points
    const coordinates = filteredPoints.map(
      (feature) => feature.geometry.coordinates
    );

    // calculate the bounding box
    const bounds = new mapboxgl.LngLatBounds();

    coordinates.forEach((coord) => {
      bounds.extend(coord);
    });

    // fit the map to the calculated bounds with padding
    map.fitBounds(bounds, {
      padding: 100 * DOT_ADJUSTMENT_FACTOR,
      duration: 1000, // duration in milliseconds for the animation
      essential: true, // ensure animation is not affected by user preferences
    });

    // disable zoom interactions when map first is scrolled upon
    // if you don't do this, user will accidentally zoom in/out upon map render
    map.scrollZoom.disable();
    map.doubleClickZoom.disable();
    map.boxZoom.disable();
    map.dragRotate.disable();
    map.keyboard.disable();

    // ee-enable zoom interactions after 5 seconds
    setTimeout(() => {
      map.scrollZoom.enable();
      map.doubleClickZoom.enable();
      map.boxZoom.enable();
      map.dragRotate.enable();
      map.keyboard.enable();
    }, 5000); // 5000 milliseconds = 5 seconds

    AnimationController.start();
  }

  // function to load borough boundaries
  async function loadBoroughs() {
    const response = await fetch("data/raw/Borough Boundaries.geojson");
    if (!response.ok) {
      throw new Error("Failed to load borough boundaries.");
    }
    const data = await response.json();
    return data;
  }

  // function to filter points within boroughs using Turf.js
  function filterPointsWithinBoroughs(points, boroughs) {
    const filtered = {
      type: "FeatureCollection",
      features: [],
    };

    points.features.forEach((point) => {
      // check if the point is within any borough
      const isInside = boroughs.features.some((borough) =>
        turf.booleanPointInPolygon(point, borough)
      );
      // only keep if inside
      if (isInside) {
        filtered.features.push(point);
      }
    });

    return filtered;
  }

  // animation Controller Object
  const AnimationController = (function () {
    let currentIndex = 0;
    let isPaused = false;
    let timeoutId = null;

    // define speeds
    const animationSpeed = 5000; // 5 seconds per plate

    // function to add a point and update the map
    function addPoints(currentDate) {
      const formattedDate = currentDate.toISOString().split("T")[0];

      map.setFilter("filtered-points-layer", [
        "all",
        ["==", ["get", "plate_id"], selectedPlateID],
        ["<=", ["get", "issue_dt_ts"], formattedDate],
      ]);

      // query features that match the current date and selectedPlateID
      const matchingFeatures = map.querySourceFeatures("filtered-points", {
        filter: [
          "all",
          ["==", ["get", "plate_id"], selectedPlateID],
          ["==", ["get", "issue_dt_ts"], formattedDate],
        ],
      });

      // highlight each matching feature
      matchingFeatures.forEach((feature) => {
        map.setFeatureState({ source: "filtered-points" }, { highlight: true });
      });

      d3.select("#map").select("#date-display").text(`Date: ${formattedDate}`);
    }

    // function to iterate through all dates
    function iterateDates() {
      if (currentIndex >= selectedPlateDates.length) {
        // stop the animation when all dates have been processed
        return;
      }

      const currentDate = selectedPlateDates[currentIndex];
      const formattedDate = currentDate.toISOString().split("T")[0];

      // add points if any
      addPoints(currentDate);
      currentIndex++;

      // schedule the next iteration
      timeoutId = setTimeout(() => {
        if (!isPaused) {
          iterateDates();
        }
      }, animationSpeed / selectedPlateDates.length);
    }

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

  // add source and layer for points when the map loads
  map.on("load", async () => {
    // load borough boundaries
    const boroughsData = await loadBoroughs();

    // filter points within boroughs
    const filteredGeojson = filterPointsWithinBoroughs(geojson, boroughsData);

    // check if there are any points after filtering
    if (filteredGeojson.features.length === 0) {
      console.warn("No points found within the five boroughs.");
      return;
    }

    // add the filtered points as a source
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
          DOT.RADIUS * 1.5, // radius when hovered
          DOT.RADIUS, // normal radius
        ],
        "circle-color": "rgb(56, 56, 241)",
        "circle-opacity": DOT.OPACITY,
      },
    });

    // initialize a single popup instance
    const popup = new mapboxgl.Popup({
      closeButton: false, // Removes the close button
      closeOnClick: false, // Keeps the popup open until mouse leaves
    });

    // initialize a variable to keep track of the currently hovered feature
    let featureId = null;
    // Add event listeners for hover interaction
    map.on("mouseenter", "filtered-points-layer", (e) => {
      // change the cursor style to pointer
      map.getCanvas().style.cursor = "pointer";

      // get the feature ID
      featureId = e.features[0].id;

      // set hover state
      map.setFeatureState(
        { source: "filtered-points", id: featureId },
        { hover: true }
      );

      // get the coordinates of the point
      const coordinates = e.features[0].geometry.coordinates.slice();

      // get the properties of the point
      const props = e.features[0].properties;

      // construct the HTML content for the popup
      const popupContent = `
        <div class = "map-popup">
          <strong>Date:</strong> ${new Date(props.date).toDateString()} <br>
          <strong>Location:</strong> ${formatString(props.location)} 
        </div>
      `;

      // ensure the popup appears above the point even if the map is moved
      while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
        coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
      }

      // set the popup's location and content, then add it to the map
      popup.setLngLat(coordinates).setHTML(popupContent).addTo(map);
    });

    map.on("mouseleave", "filtered-points-layer", () => {
      if (featureId !== null) {
        // reset the hover state
        map.setFeatureState(
          { source: "filtered-points", id: featureId },
          { hover: false }
        );
      }
      featureId = null;

      // reset the cursor style
      map.getCanvas().style.cursor = "";
      // remove the popup
      popup.remove();
    });

    map.setFilter("filtered-points-layer", [
      "==",
      ["get", "plate_id"],
      selectedPlateID,
    ]);

    adjustMapBounds(selectedPlateID);
  });

  // add navigation controls
  map.addControl(new mapboxgl.NavigationControl());
}

// *******************
// scroll
// *******************

// array of all visual functions
// to be called by the scroller functionality
let activationFunctions = [
  () => {
    drawCumDist();
    hideMap();
  },
  () => {},
  () => {
    drawCumDist(50.5, 100);
    hideMap();
  },
  () => {
    drawCumDist(99, 100);
    hideMap();
    cleanBoroughPacks(true);
  },
  () => {
    cleanCumDist(true);
    hideImage(".centered-image-2", ".image-caption-2");
    hideImage(".centered-image", ".image-caption");
    drawBoroughPacks();
  },
  () => {
    // a bit hacky, but need to include these cum dist functions to get draw borough packs
    // to behave consistently on up/down scrolls
    drawCumDist(99, 100);
    cleanCumDist(true);
    cleanBoroughPacks();
    showImage(".centered-image-2", ".image-caption-2");
    hideImage(".centered-image", ".image-caption");
  },
  () => {
    hideImage(".centered-image-2", ".image-caption-2");
    showImage(".centered-image", ".image-caption");
    hideMap();
  },
  () => {
    drawMapbox();
    hideImage(".centered-image-2", ".image-caption-2");
    hideImage(".centered-image", ".image-caption");
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
    activationFunctions[i]();
  });
  lastIndex = activeIndex;
});

// reload on top of page
history.scrollRestoration = "manual";
