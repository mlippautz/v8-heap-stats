import React from "react";
import ReactDOM from "react-dom";

import V8HeapStats from "./v8-heap-stats";

ReactDOM.render(
  <V8HeapStats name="World"/>,
  document.getElementById('content')
);
