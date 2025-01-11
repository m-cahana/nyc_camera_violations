window.addEventListener("load", function () {
  const loader = document.getElementById("loader");

  // Start the fade-out transition
  loader.style.opacity = "0";

  // After the transition duration, hide the loader and show the content
  setTimeout(function () {
    loader.style.display = "none";
    document.body.classList.remove("loading"); // Re-enable scrolling if it was disabled
  }, 1000); // Duration should match the CSS transition (0.5s)
});
