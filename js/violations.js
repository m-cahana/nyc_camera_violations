/*
 *    first stab at visuals
 */

// margins
const MARGIN = { LEFT: 100, RIGHT: 100, TOP: 20, BOTTOM: 20 };
const WIDTH = 800;
const HEIGHT = 500;

// svg
const svg = d3
  .select("#chart-area")
  .append("svg")
  .attr("width", WIDTH + MARGIN.LEFT + MARGIN.RIGHT)
  .attr("height", HEIGHT + MARGIN.TOP + MARGIN.BOTTOM);

const g = svg.append("g").attr("transform", `translate(0, 0)`);

// axes
const x = d3
  .scaleLinear()
  .domain([0, 100])
  .range([MARGIN.LEFT, WIDTH - MARGIN.RIGHT]);

const y = d3
  .scaleLinear()
  .domain([0, 100])
  .range([HEIGHT - MARGIN.BOTTOM, MARGIN.TOP]);

svg
  .append("g")
  .attr("transform", `translate(0, ${HEIGHT - MARGIN.BOTTOM})`)
  .call(d3.axisBottom(x));

svg
  .append("g")
  .attr("transform", `translate(${MARGIN.LEFT},0)`)
  .call(d3.axisLeft(y));

// labels
const xLabel = g
  .append("text")
  .attr("y", HEIGHT + 10)
  .attr("x", WIDTH / 2)
  .attr("font-size", "20px")
  .attr("text-anchor", "middle")
  .text("Share of drivers");

const yLabel = g
  .append("text")
  .attr("transform", "rotate(-90)")
  .attr("y", 0)
  .attr("x", 0)
  .attr("font-size", "20px")
  .attr("text-anchor", "middle")
  .text("Share of school zone violations");

// iterator
let data_index = 0;
let index_increment = 100;

// data read-in
d3.csv("data/processed/school_zone_violations_sparse.csv").then((data) => {
  data.forEach((d) => {
    d.row_pct = Number(d.row_pct * 100);
    d.cum_share = Number(d.cum_share * 100);
    d.school_zone_violations = Number(d.school_zone_violations);
  });

  // helper function
  function dashedLine(violation_threshold) {
    return g
      .append("line")
      .style("stroke-dasharray", "5,5")
      .style("stroke", "red")
      .attr(
        "x1",
        x(
          d3.max(
            data.filter((d) => d.school_zone_violations == violation_threshold),
            (d) => d.row_pct
          )
        )
      )
      .attr("y1", y(0))
      .attr(
        "x2",
        x(
          d3.max(
            data.filter((d) => d.school_zone_violations == violation_threshold),
            (d) => d.row_pct
          )
        )
      )
      .attr("y2", y(100));
  }

  const line1 = dashedLine(1);
  const line5 = dashedLine(5);
  const line10 = dashedLine(10);
  const line15 = dashedLine(15);

  // run the code every 0.1 second
  d3.interval(function () {
    // at the end of our data, stop
    data_index += index_increment;
    if (data_index <= data.length + index_increment) {
      update(data.slice(0, Math.min(data_index + 1, data.length)));
    }
  }, 5);

  update(data.slice(0, data_index + 1));
});

function update(data) {
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
      return x(d.row_pct);
    })
    .attr("cy", function (d) {
      return y(d.cum_share);
    })
    .attr("r", 2)
    .style("fill", "#69b3a2");
}
