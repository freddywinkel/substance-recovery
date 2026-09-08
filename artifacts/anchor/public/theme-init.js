// Run before rendering to preserve the chosen theme without an inline script.
try {
  const savedTheme = localStorage.getItem("anchor-theme");
  const theme = savedTheme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "light" ? "#F7F5F3" : "#0D0C0B");
} catch {
  document.documentElement.dataset.theme = "dark";
  document.documentElement.classList.add("dark");
}
