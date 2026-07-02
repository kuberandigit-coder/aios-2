// Digital Marketing Member Reports — shared JS
// Currently minimal by design: pages are static and must work offline.
// Adds a simple client-side name filter on the index page if the search box exists.
document.addEventListener("DOMContentLoaded", function () {
  var box = document.getElementById("member-search");
  if (!box) return;
  box.addEventListener("input", function () {
    var q = box.value.trim().toLowerCase();
    document.querySelectorAll(".grid .card").forEach(function (card) {
      var name = card.querySelector(".name").textContent.toLowerCase();
      card.style.display = name.indexOf(q) === -1 ? "none" : "";
    });
  });
});
