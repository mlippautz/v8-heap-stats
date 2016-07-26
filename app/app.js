import React from "react";  // eslint-disable-line no-unused-vars
import ReactDOM from "react-dom";

import V8HeapStats from "./v8-heap-stats";  // eslint-disable-line no-unused-vars

ReactDOM.render(
  <V8HeapStats name="World"/>,
  document.getElementById('content')
);
