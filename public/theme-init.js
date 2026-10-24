// Apply the saved/system theme before first paint, so the loading screen does not flash light
// for dark-mode users while next-themes mounts. Mirrors ThemeProvider (attribute "class",
// storage key "theme", default "system"). External file: the CSP blocks inline scripts.
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var theme = stored === "light" || stored === "dark"
      ? stored
      : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    var root = document.documentElement;
    root.classList.add(theme);
    root.style.colorScheme = theme;
  } catch (e) {
    // Storage blocked: next-themes applies the theme after mount.
  }
})();
