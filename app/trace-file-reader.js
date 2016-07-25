import React from "react";

export default React.createClass({
  getInitialState: function() {
    return {
      innerText: "Drag and drop a trace file into " +
                  "this area, or click to choose from disk."
    };
  },

  readFile: function(file) {
    if (file) {
      const result = new FileReader();
      result.onload = function(e) {
        let contents = e.target.result.split("\n");
        contents = contents.map(function(line) {
          try {
            return JSON.parse(line);
          } catch (e) {
            console.log("unable to parse line: '" + line + "'' (" + e + ")");
          }
          return null;
        });

        const data = {};  // Final data container.
        const keys = {};  // Collecting 'keys' per isolate.

        let createEntryIfNeeded = entry => {
          if (!(entry.isolate in data)) {
            data[entry.isolate] = {
              non_empty_instance_types: new Set(),
              gcs: {}
            };
          }
          if (!(entry.id in data[entry.isolate].gcs)) {
            data[entry.isolate].gcs[entry.id] = {
              non_empty_instance_types: new Set()
            };
          }
        };

        for (var entry of contents) {
          if (entry === null) continue;
          if (entry.type === undefined) continue;

          if (entry.type === "gc_descriptor") {
            createEntryIfNeeded(entry);
            data[entry.isolate].gcs[entry.id].time = entry.time;
          } else if (entry.type === "instance_type_data") {
            if (entry.id in data[entry.isolate].gcs) {
              createEntryIfNeeded(entry);
              if (!(entry.key in data[entry.isolate].gcs[entry.id])) {
                data[entry.isolate].gcs[entry.id][entry.key] = {
                  instance_type_data: {},
                  non_empty_instance_types: new Set(),
                  overall: 0
                };
              }
              if (entry.overall !== 0) {
                var instance_type_name = entry.instance_type_name;
                var id = entry.id;
                var key = entry.key;
                if (!(entry.isolate in keys)) {
                  keys[entry.isolate] = new Set();
                }
                keys[entry.isolate].add(key);
                data[entry.isolate].gcs[id][key]
                  .instance_type_data[instance_type_name] = {
                    overall: entry.overall,
                    count: entry.count,
                    over_allocated: entry.over_allocated,
                    overall_histogram: entry.histogram,
                    over_allocated_histogram: entry.over_allocated_histogram
                  };
                data[entry.isolate].gcs[id][key].overall += entry.overall;

                data[entry.isolate].gcs[id][key].non_empty_instance_types.add(
                  instance_type_name);
                data[entry.isolate].gcs[id].non_empty_instance_types.add(
                  instance_type_name);
                data[entry.isolate].non_empty_instance_types.add(
                  instance_type_name);
              }
            }
          } else if (entry.type === "bucket_sizes") {
            if (entry.id in data[entry.isolate].gcs) {
              createEntryIfNeeded(entry);
              if (!(entry.key in data[entry.isolate].gcs[entry.id])) {
                data[entry.isolate].gcs[entry.id][entry.key] = {
                  instance_type_data: {},
                  non_empty_instance_types: new Set(),
                  overall: 0
                };
              }
              data[entry.isolate].gcs[entry.id][entry.key].bucket_sizes =
                entry.sizes;
            }
          } else {
            console.log("Unknown entry type: " + entry.type);
          }
        }

        function checkNonNegativeProperty(obj, property) {
          if (obj[property] < 0) {
            console.log("Propery '" + property + "' negative: " + obj[property]);
          }
        }

        for (const isolate in data) {
          for (const gc in data[isolate].gcs) {
            for (const key of keys[isolate]) {
              const dataSet = data[isolate].gcs[gc][key];
              // (1) Create a ranked instance type array that sorts instance
              // types by memory size (overall).
              dataSet.ranked_instance_types =
                [... dataSet.non_empty_instance_types].sort(function(a, b) {
                  if (dataSet.instance_type_data[a].overall > dataSet.instance_type_data[b].overall) {
                    return 1;
                  } else if (dataSet.instance_type_data[a].overall < dataSet.instance_type_data[b].overall) {
                    return -1;
                  }
                  return 0;
                });

              // (2) Create *FIXED_ARRAY_UNKNOWN_SUB_TYPE that accounts for all
              // missing fixed array sub types.
              const fixed_array_data = Object.assign({}, dataSet.instance_type_data.FIXED_ARRAY_TYPE);
              for (const instance_type in dataSet.instance_type_data) {
                if (!instance_type.startsWith("*FIXED_ARRAY")) continue;
                const subtype = dataSet.instance_type_data[instance_type];
                fixed_array_data.count -= subtype.count;
                fixed_array_data.overall -= subtype.overall;
                for (let i = 0;
                     i < fixed_array_data.overall_histogram.length;
                     i++) {
                  fixed_array_data.overall_histogram[i] -= subtype.overall_histogram[i];
                }
              }

              // Emit log messages for negative values.
              checkNonNegativeProperty(fixed_array_data, "count");
              checkNonNegativeProperty(fixed_array_data, "overall");
              for (let i = 0; i < fixed_array_data.overall_histogram.length; i++) {
                checkNonNegativeProperty(fixed_array_data.overall_histogram, i);
              }

              dataSet.instance_type_data["*FIXED_ARRAY_UNKNOWN_SUB_TYPE"] = fixed_array_data;
              dataSet.non_empty_instance_types.add("*FIXED_ARRAY_UNKNOWN_SUB_TYPE");
            }
          }
        }
        console.log(data);
        this.handleDone(data, file.name);
      }.bind(this);
      result.readAsText(file);
    } else {
      console.log("Failed to load file");
    }
  },

  handleDone: function(data, fileName) {
    this.setState({
      innerText: "Finished loading '" + fileName + "'"
    });
    this.props.onNewData(data);
  },

  handleChange: function(event) {
    event.preventDefault();
    var host = event.dataTransfer ? event.dataTransfer : event.target;
    this.readFile(host.files[0]);
  },

  handleDragOver: function(event) {
    event.preventDefault();
  },

  handleClick: function(event) {
    this.refs.file.value = null;
    this.refs.file.click();
  },

  render: function() {
    var dragDropStyle = {
      width: "100%",
      height: "100px",
      lineHeight: "100px",
      textAlign: "center",
      border: "solid 1px #000000",
      borderRadius: "5px"
    };
    var inputStyle = {
      display: "none"
    };
    return (
      <div style={dragDropStyle}
           onDragOver={this.handleDragOver}
           onDrop={this.handleChange}
           onClick={this.handleClick}>
        {this.state.innerText}
        <input ref="file" type="file" name="file" onChange={this.handleChange} style={inputStyle} />
      </div>
    );
  }
});
