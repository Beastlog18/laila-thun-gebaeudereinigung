document.addEventListener("DOMContentLoaded", () => {
  console.log("WebApp geladen – Version 0.2");

  // Kontaktformular Dummy
  const form = document.querySelector("#contactForm");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      alert("Nachricht wurde gesendet (Demo).");
    });
  }
});
