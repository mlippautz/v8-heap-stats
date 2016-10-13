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
            // Strip away a potentially present adb logcat prefix.
            line = line.replace(/^I\/v8\s*\(\d+\):\s+/g, "");
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
              nonEmptyInstanceTypes: new Set(),
              gcs: {},
              zonetags: [],
              samples: {
                zone: {}
              },
              start: null,
              end: null
            };
          }
          if (("id" in entry) && !(entry.id in data[entry.isolate].gcs)) {
            data[entry.isolate].gcs[entry.id] = {
              nonEmptyInstanceTypes: new Set()
            };
          }
        };

        for (var entry of contents) {
          if (entry === null || entry.type === undefined) {
            continue;
          }
          if (entry.type === "zone") {
            createEntryIfNeeded(entry);
            const stacktrace = ("stacktrace" in entry) ? entry.stacktrace : [];
            data[entry.isolate].samples.zone[entry.time] =
              {allocated: entry.allocated, pooled: entry.pooled, stacktrace: stacktrace};
            if (entry.time > data[entry.isolate].end)
              data[entry.isolate].end = entry.time;
            if (data[entry.isolate].start === null)
              data[entry.isolate].start = entry.time;
          } else if (entry.type === "zonecreation" || entry.type === "zonedestruction") {
            createEntryIfNeeded(entry);
            var tag = {
              opening: entry.type === "zonecreation",
              time: entry.time,
              ptr: entry.ptr,
              name: entry.name,
              size: {
                total: entry.total_size,
                used: entry.used_size,
                segment_header: entry.segment_header_size,
                wasted: entry.wasted_size
              }
            };

            data[entry.isolate].zonetags.push(tag);

            if (entry.time > data[entry.isolate].end)
              data[entry.isolate].end = entry.time;
            if (data[entry.isolate].start === null)
              data[entry.isolate].start = entry.time;
          } else if (entry.type === "gc_descriptor") {
            createEntryIfNeeded(entry);
            data[entry.isolate].gcs[entry.id].time = entry.time;
            if (entry.time > data[entry.isolate].end)
              data[entry.isolate].end = entry.time;
            if (data[entry.isolate].start === null)
              data[entry.isolate].start = entry.time;
            if ("zone" in entry)
              data[entry.isolate].gcs[entry.id].malloced = entry.zone;
          } else if (entry.type === "instance_type_data") {
            if (entry.id in data[entry.isolate].gcs) {
              createEntryIfNeeded(entry);
              if (!(entry.key in data[entry.isolate].gcs[entry.id])) {
                data[entry.isolate].gcs[entry.id][entry.key] = {
                  instanceTypeData: {},
                  nonEmptyInstanceTypes: new Set(),
                  overall: 0
                };
              }
              const instanceTypeName = entry.instance_type_name;
              const id = entry.id;
              const key = entry.key;
              if (!(entry.isolate in keys)) {
                keys[entry.isolate] = new Set();
              }
              keys[entry.isolate].add(key);
              data[entry.isolate].gcs[id][key]
                .instanceTypeData[instanceTypeName] = {
                  overall: entry.overall,
                  count: entry.count,
                  overAllocated: entry.over_allocated,
                  overallHistogram: entry.histogram,
                  overAllocatedHistogram: entry.over_allocated_histogram
                };
              data[entry.isolate].gcs[id][key].overall += entry.overall;

              if (entry.overall !== 0) {
                data[entry.isolate].gcs[id][key].nonEmptyInstanceTypes.add(
                  instanceTypeName);
                data[entry.isolate].gcs[id].nonEmptyInstanceTypes.add(
                  instanceTypeName);
                data[entry.isolate].nonEmptyInstanceTypes.add(
                  instanceTypeName);
              }
            }
          } else if (entry.type === "bucket_sizes") {
            if (entry.id in data[entry.isolate].gcs) {
              createEntryIfNeeded(entry);
              if (!(entry.key in data[entry.isolate].gcs[entry.id])) {
                data[entry.isolate].gcs[entry.id][entry.key] = {
                  instanceTypeData: {},
                  nonEmptyInstanceTypes: new Set(),
                  overall: 0
                };
              }
              data[entry.isolate].gcs[entry.id][entry.key].bucketSizes =
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

        for (const isolate of Object.keys(data)) {
          for (const gc of Object.keys(data[isolate].gcs)) {
            for (const key of keys[isolate]) {
              const dataSet = data[isolate].gcs[gc][key];
              // (1) Create a ranked instance type array that sorts instance
              // types by memory size (overall).
              dataSet.rankedInstanceTypes =
                [... dataSet.nonEmptyInstanceTypes].sort(function(a, b) {
                  if (dataSet.instanceTypeData[a].overall > dataSet.instanceTypeData[b].overall) {
                    return 1;
                  } else if (dataSet.instanceTypeData[a].overall < dataSet.instanceTypeData[b].overall) {
                    return -1;
                  }
                  return 0;
                });

              // (2) Create *FIXED_ARRAY_UNKNOWN_SUB_TYPE that accounts for all
              // missing fixed array sub types.
              const fixedArrayData = Object.assign({}, dataSet.instanceTypeData.FIXED_ARRAY_TYPE);
              for (const instanceType in dataSet.instanceTypeData) {
                if (!instanceType.startsWith("*FIXED_ARRAY")) continue;
                const subtype = dataSet.instanceTypeData[instanceType];
                fixedArrayData.count -= subtype.count;
                fixedArrayData.overall -= subtype.overall;
                for (let i = 0;
                     i < fixedArrayData.overallHistogram.length;
                     i++) {
                  fixedArrayData.overallHistogram[i] -= subtype.overallHistogram[i];
                }
              }

              // Emit log messages for negative values.
              checkNonNegativeProperty(fixedArrayData, "count");
              checkNonNegativeProperty(fixedArrayData, "overall");
              for (let i = 0; i < fixedArrayData.overallHistogram.length; i++) {
                checkNonNegativeProperty(fixedArrayData.overallHistogram, i);
              }

              dataSet.instanceTypeData["*FIXED_ARRAY_UNKNOWN_SUB_TYPE"] = fixedArrayData;
              dataSet.nonEmptyInstanceTypes.add("*FIXED_ARRAY_UNKNOWN_SUB_TYPE");
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
