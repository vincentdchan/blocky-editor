import { render } from "preact";
import App from "./app";

const appId = "blocky-example-app";

render(<App />, document.getElementById(appId)!);
