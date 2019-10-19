window.ga =
  window.ga ||
  function() {
    (ga.q = ga.q || []).push(arguments);
  };
ga.l = +new Date();
ga("create", "UA-93963699-1", { cookieDomain: "docodethatmatters.com" });
// Plugins
ga("require", "displayfeatures");
ga("require", "ec");
ga("require", "linkid", "linkid.js");
ga("require", "outboundLinkTracker");
ga("send", "pageview");

function hideBurger() {
  document.getElementById("bmenu").click();
}
document.onkeydown = function(e) {
  if (e.keyCode == 27) {
    hideBurger();
  }
};
