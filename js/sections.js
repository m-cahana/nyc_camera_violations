let dataset, svg, g;
let cumXScale, cumYScale;
let simulation, nodes;

const MARGIN = { LEFT: 100, RIGHT: 100, TOP: 20, BOTTOM: 20 };
const WIDTH = 800;
const HEIGHT = 500;

const functionClasses = [
  "first-cum-dist",
  "second-cum-dist",
  "third-cum-dist",
  "fourth-cum-dist",
  "fifth-cum-dist",
  "sixth-cum-dist",
];

console.log(functionClasses.filter((x) => x !== "third-cum-dist"));
//Read Data, convert numerical categories into floats
//Create the initial visualisation

d3.csv("data/processed/school_zone_violations_sparse.csv").then((data) => {
  data.forEach((d) => {
    d.row_pct = Number(d.row_pct * 100);
    d.cum_share = Number(d.cum_share * 100);
    d.school_zone_violations = Number(d.school_zone_violations);
  });

  dataset = data;

  setTimeout(drawInitial(), 100);
});

// All the initial elements should be create in the drawInitial function
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

  let svg = d3
    .select("#vis")
    .append("svg")
    .attr("width", WIDTH + MARGIN.LEFT + MARGIN.RIGHT)
    .attr("height", HEIGHT + MARGIN.TOP + MARGIN.BOTTOM)
    .attr("opacity", 1);

  svg
    .append("g")
    .attr("class", "first-cum-dist")
    .attr("opacity", 1)
    .selectAll("dot")
    .data(dataset)
    .enter()
    .append("circle")
    .attr("cx", function (d) {
      return cumXScale(d.row_pct);
    })
    .attr("cy", function (d) {
      return cumYScale(d.cum_share);
    })
    .attr("r", 2)
    .style("fill", "red");

  svg
    .append("g")
    .attr("class", "second-cum-dist")
    .attr("opacity", 1)
    .attr("opacity", 1)
    .selectAll("dot")
    .data(dataset)
    .enter()
    .append("circle")
    .attr("cx", function (d) {
      return cumXScale(d.row_pct);
    })
    .attr("cy", function (d) {
      return cumYScale(d.cum_share);
    })
    .attr("r", 2)
    .style("fill", "orange");

  svg
    .append("g")
    .attr("class", "third-cum-dist")
    .attr("opacity", 1)
    .attr("opacity", 1)
    .selectAll("dot")
    .data(dataset)
    .enter()
    .append("circle")
    .attr("cx", function (d) {
      return cumXScale(d.row_pct);
    })
    .attr("cy", function (d) {
      return cumYScale(d.cum_share);
    })
    .attr("r", 2)
    .style("fill", "green");
  svg
    .append("g")
    .attr("class", "fourth-cum-dist")
    .attr("opacity", 1)
    .attr("opacity", 1)
    .selectAll("dot")
    .data(dataset)
    .enter()
    .append("circle")
    .attr("cx", function (d) {
      return cumXScale(d.row_pct);
    })
    .attr("cy", function (d) {
      return cumYScale(d.cum_share);
    })
    .attr("r", 2)
    .style("fill", "blue");
  svg
    .append("g")
    .attr("class", "fifth-cum-dist")
    .attr("opacity", 1)
    .attr("opacity", 1)
    .selectAll("dot")
    .data(dataset)
    .enter()
    .append("circle")
    .attr("cx", function (d) {
      return cumXScale(d.row_pct);
    })
    .attr("cy", function (d) {
      return cumYScale(d.cum_share);
    })
    .attr("r", 2)
    .style("fill", "yellow");
  svg
    .append("g")
    .attr("class", "sixth-cum-dist")
    .attr("opacity", 1)
    .attr("opacity", 1)
    .selectAll("dot")
    .data(dataset)
    .enter()
    .append("circle")
    .attr("cx", function (d) {
      return cumXScale(d.row_pct);
    })
    .attr("cy", function (d) {
      return cumYScale(d.cum_share);
    })
    .attr("r", 2)
    .style("fill", "red");
}

//Cleaning Function
//Will hide all the elements which are not necessary for a given chart type
function clean(graphName) {
  functionClasses
    .filter((x) => x !== graphName)
    .forEach((functionClass) =>
      d3
        .select("#vis")
        .select("svg")
        .select(`.${functionClass}`)
        .attr("opacity", 0)
    );
}

//First draw function

function draw1() {
  // iterator
  var data_index = 0;
  var index_increment = 100;
  //Stop simulation
  simulation.stop();

  let svg = d3
    .select("#vis")
    .select("svg")
    .attr("width", WIDTH + MARGIN.LEFT + MARGIN.RIGHT)
    .attr("height", HEIGHT + MARGIN.TOP + MARGIN.BOTTOM);

  clean();

  svg.select(".cum-dist").attr("opacity", 1);

  g = svg.append("g").attr("transform", `translate(0, 0)`);

  // axes
  cumXScale = d3
    .scaleLinear()
    .domain([0, 100])
    .range([MARGIN.LEFT, WIDTH - MARGIN.RIGHT]);

  cumYScale = d3
    .scaleLinear()
    .domain([0, 100])
    .range([HEIGHT - MARGIN.BOTTOM, MARGIN.TOP]);

  svg
    .append("g")
    .attr("transform", `translate(0, ${HEIGHT - MARGIN.BOTTOM})`)
    .call(d3.axisBottom(cumXScale));

  svg
    .append("g")
    .attr("transform", `translate(${MARGIN.LEFT},0)`)
    .call(d3.axisLeft(cumYScale));

  // run the code every 0.1 second
  d3.interval(function () {
    // at the end of our data, stop
    data_index += index_increment;
    if (data_index <= dataset.length + index_increment) {
      updateCumDist(dataset.slice(0, Math.min(data_index + 1, dataset.length)));
    }
  }, 5);

  updateCumDist(dataset.slice(0, data_index + 1));
}

function genDraw(graphName) {
  svg = d3.select("#vis").select("svg");
  // Instantiate the force simulation
  // simulation
  simulation = d3.forceSimulation(dataset);
  console.log(simulation);

  // Define each tick of simulation
  simulation.on("tick", () => {
    nodes.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
  });

  // Selection of all the circles
  nodes = svg
    .selectAll("dot")
    .data(dataset)
    .enter()
    .append("circle")
    .attr("cx", function (d) {
      return cumXScale(d.row_pct);
    })
    .attr("cy", function (d) {
      return cumYScale(d.cum_share);
    })
    .attr("r", 2);

  // Stop the simulation until later
  simulation
    .force(
      "forceX",
      d3.forceX((d) => cumXScale(d.row_pct))
    )
    .force(
      "forceY",
      d3.forceY((d) => cumYScale(d.cum_share))
    );

  simulation.alpha(0.9).restart();

  console.log(simulation);

  svg = d3.select("#vis").select("svg").select(`.${graphName}`);

  // iterator
  var data_index = 0;
  var index_increment = 100;

  clean(graphName);

  svg
    .attr("width", WIDTH + MARGIN.LEFT + MARGIN.RIGHT)
    .attr("height", HEIGHT + MARGIN.TOP + MARGIN.BOTTOM)
    .attr("opacity", 1);

  // axes
  cumXScale = d3
    .scaleLinear()
    .domain([0, 100])
    .range([MARGIN.LEFT, WIDTH - MARGIN.RIGHT]);

  cumYScale = d3
    .scaleLinear()
    .domain([0, 100])
    .range([HEIGHT - MARGIN.BOTTOM, MARGIN.TOP]);
  svg
    .selectAll("circle")
    .transition()
    .duration(1000)
    .delay((d, i) => i * 2)
    .ease(d3.easeBackIn)
    .attr("cx", (d) => cumXScale(d.row_pct))
    .attr("cy", (d) => cumYScale(d.cum_share));

  svg
    .attr("transform", `translate(0, ${HEIGHT - MARGIN.BOTTOM})`)
    .call(d3.axisBottom(cumXScale));

  svg
    .attr("transform", `translate(${MARGIN.LEFT},0)`)
    .call(d3.axisLeft(cumYScale));
}

function updateCumDist(data) {
  // standard transition time for the visualization
  const t = d3.transition().duration(100);

  // JOIN new data with old elements.
  const dots = g.selectAll("dot").data(data);

  // EXIT old elements not present in new data.
  dots.exit().remove();

  // ENTER new elements present in new data.
  dots
    .enter()
    .append("circle")
    .attr("cx", function (d) {
      return cumXScale(d.row_pct);
    })
    .attr("cy", function (d) {
      return cumYScale(d.cum_share);
    })
    .attr("r", 2)
    .style("fill", "red");
}

function draw2() {
  // iterator
  var data_index = 1000;
  var index_increment = 100;
  //Stop simulation
  simulation.stop();

  let svg = d3
    .select("#vis")
    .select("svg")
    .attr("class", "cum-dist")
    .attr("width", WIDTH + MARGIN.LEFT + MARGIN.RIGHT)
    .attr("height", HEIGHT + MARGIN.TOP + MARGIN.BOTTOM);

  clean();

  svg.select(".cum-dist").attr("opacity", 1);

  g = svg.append("g").attr("transform", `translate(0, 0)`);

  // axes
  cumXScale = d3
    .scaleLinear()
    .domain([0, 100])
    .range([MARGIN.LEFT, WIDTH - MARGIN.RIGHT]);

  cumYScale = d3
    .scaleLinear()
    .domain([0, 100])
    .range([HEIGHT - MARGIN.BOTTOM, MARGIN.TOP]);

  svg
    .append("g")
    .attr("transform", `translate(0, ${HEIGHT - MARGIN.BOTTOM})`)
    .call(d3.axisBottom(cumXScale));

  svg
    .append("g")
    .attr("transform", `translate(${MARGIN.LEFT},0)`)
    .call(d3.axisLeft(cumYScale));

  // run the code every 0.1 second
  d3.interval(function () {
    // at the end of our data, stop
    data_index += index_increment;
    if (data_index <= dataset.length + index_increment) {
      updateCumDist(dataset.slice(0, Math.min(data_index + 1, dataset.length)));
    }
  }, 5);

  updateCumDist(dataset.slice(0, data_index + 1));
}
//Array of all the graph functions
//Will be called from the scroller functionality

let activationFunctions = [
  () => genDraw("first-cum-dist"),
  () => genDraw("second-cum-dist"),
  () => genDraw("third-cum-dist"),
  () => genDraw("fourth-cum-dist"),
  () => genDraw("fifth-cum-dist"),
  () => genDraw("sixth-cum-dist"),
];

//All the scrolling function
//Will draw a new graph based on the index provided by the scroll

let scroll = scroller().container(d3.select("#graphic"));
console.log("hiii");
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
  }
});
