document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("#loginForm");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      alert("Login (Demo) – Supabase folgt ab Version 0.3");
      window.location.href = "dashboard.html";
    });
  }
});
