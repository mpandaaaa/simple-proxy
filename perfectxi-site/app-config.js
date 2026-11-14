/* =====================================================================
   PERFECT XI - APP LAUNCH SWITCH
   On the day the app is approved, change LIVE to true and paste the two
   values below. Every banner, button and link on the whole site flips
   from "coming soon" to "download" automatically. Nothing else to edit.
   ===================================================================== */
window.PXI_APP = {
  LIVE: false,                       // <-- the only thing to change on launch day
  APP_ID: "0000000000",              // <-- numeric App Store ID
  STORE_URL: "https://apps.apple.com/gb/app/perfect-xi/id0000000000",
  /* where the notify-me form posts. Free options: formspree.io, buttondown,
     or any endpoint that accepts a POST with an "email" field.            */
  NOTIFY_ENDPOINT: "",               // <-- paste your form endpoint here
  LAUNCH_LABEL: "Coming soon to iPhone"
};
/* campaign tags so App Store Connect shows which page drove each install */
window.pxiStoreLink = function(where){
  var a = window.PXI_APP;
  if (!a.LIVE) return "/ios";
  var sep = a.STORE_URL.indexOf("?") < 0 ? "?" : "&";
  return a.STORE_URL + sep + "pt=perfectxi&ct=" + encodeURIComponent(where || "site");
};
