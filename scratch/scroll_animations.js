var oldWidth = 0;
function render() {
  if (oldWidth == innerWidth) return;
  oldWidth = innerWidth;

  var width = (height = d3.select("#graph").node().offsetWidth);
  var r = 40;

  if (innerWidth <= 925) {
    width = innerWidth;
    height = innerHeight * 0.7;
  }

  // return console.log(width, height)

  var svg = d3
    .select("#graph")
    .html("")
    .append("svg")
    .attrs({ width: width, height: height });

  var circle = svg.append("circle").attrs({ cx: 0, cy: 0, r: r });

  var colors = ["orange", "purple", "steelblue", "pink", "black"];
  var gs = d3
    .graphScroll()
    .container(d3.select(".container-1"))
    .graph(d3.selectAll("container-1 #graph"))
    .eventId("uniqueId1") // namespace for scroll and resize events
    .sections(d3.selectAll(".container-1 #sections > div"))
    // .offset(innerWidth < 900 ? innerHeight - 30 : 200)
    .on("active", function (i) {
      var pos = [
        { cx: width - r, cy: r },
        { cx: r, cy: r },
        { cx: width - r, cy: height - r },
        { cx: width / 2, cy: height / 2 },
      ][i];

      circle
        .transition()
        .duration(1000)
        .attrs(pos)
        .transition()
        .style("fill", colors[i]);
    });

  var svg2 = d3
    .select(".container-2 #graph")
    .html("")
    .append("svg")
    .attrs({ width: width, height: height });

  var path = svg2.append("path");

  var gs2 = d3
    .graphScroll()
    .container(d3.select(".container-2"))
    .graph(d3.selectAll(".container-2 #graph"))
    .eventId("uniqueId2") // namespace for scroll and resize events
    .sections(d3.selectAll(".container-2 #sections > div"))
    .on("active", function (i) {
      var h = height;
      var w = width;
      var dArray = [
        [
          [w / 4, h / 4],
          [(w * 3) / 4, h / 4],
          [(w * 3) / 4, (h * 3) / 4],
          [w / 4, (h * 3) / 4],
        ],
        [
          [0, 0],
          [(w * 3) / 4, h / 4],
          [(w * 3) / 4, (h * 3) / 4],
          [w / 4, (h * 3) / 4],
        ],
        [
          [w / 2, h / 2],
          [w, h / 4],
          [w, h],
          [w / 4, h],
        ],
        [
          [w / 2, h / 2],
          [w, h / 4],
          [w, h],
          [w / 4, h],
        ],
        [
          [w / 2, h / 2],
          [w, h / 2],
          [0, 0],
          [w / 4, h / 2],
        ],
        [
          [w / 2, h / 2],
          [0, h / 4],
          [0, h / 2],
          [w / 4, 0],
        ],
      ].map(function (d) {
        return "M" + d.join(" L ");
      });

      path
        .transition()
        .duration(1000)
        .attr("d", dArray[i])
        .style("fill", colors[i]);
    });

  d3.select("#source").styles({
    "margin-bottom": window.innerHeight - 450 + "px",
    padding: "100px",
  });
}
render();
d3.select(window).on("resize", render);
