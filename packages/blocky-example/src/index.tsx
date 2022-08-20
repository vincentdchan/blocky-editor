import { render, Component } from "preact";
import Router, { route } from "preact-router";
import App from "./app";
import Documentation from "./documentations";
import GetStartedDoc from "./docs/get-started.md?raw";
import DataManiDoc from "./docs/data-manipulation.md?raw";
import WriteBlockDoc from "./docs/how-to-write-a-block.md?raw";
import FollowerWidgetDoc from "./docs/follower-widget.md?raw";

const appId = "blocky-example-app";

interface RedirectProps {
  to: string;
}

class Redirect extends Component<RedirectProps> {
  componentWillMount() {
    console.log("route");
    route(this.props.to, true);
  }

  render() {
    return null;
  }
}

render(
  <Router>
    <App path="/" />
    <Documentation path="/doc/get-started" content={GetStartedDoc} />
    <Documentation path="/doc/data-manipulations" content={DataManiDoc} />
    <Documentation path="/doc/how-to-write-a-block" content={WriteBlockDoc} />
    <Documentation path="/doc/follower-widget" content={FollowerWidgetDoc} />
    <Redirect path="/doc" to="/doc/get-started" />
  </Router>,
  document.getElementById(appId)!
);
