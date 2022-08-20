import { render } from "preact";
import Router from "preact-router";
import App from "./app";
import Documentation from "./documentations";

const appId = "blocky-example-app";

render(
  <Router>
    <App path="/" />
    <Documentation path="/documentations" />
  </Router>,
  document.getElementById(appId)!
);
