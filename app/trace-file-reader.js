import React from "react";

export default React.createClass({
  getInitialState: function() {
    return {
      inner_text: "Drag and drop a trace file into this area, or click to choose from disk."
    };
  },
  readFile: function(file) {
    if (file) {
      var result = new FileReader();
      result.onload = function(e) { 
        var contents = e.target.result.split("\n");
        contents = contents.map(function (line) {
          try {
            return JSON.parse(line);
          } catch(e) {
            console.log("unable to parse line: '" + line + "'' ("+ e +")")
          }
          return null;
        });
        var data = {
          non_empty_instance_types: new Set(),
          gcs: {}
        };
        let keys = new Set();
        for (var entry of contents) {
          if (entry == null) continue;
          if (entry.type == undefined) continue;

          if (entry.type === "gc_descriptor") {
            if (!(entry.id in data.gcs)) {
              data.gcs[entry.id] = {
                time: entry.time,
                non_empty_instance_types: new Set()
              };
            }
          } else if (entry.type === "instance_type_data") {
            if (entry.id in data.gcs) {
              if (!(entry.key in data.gcs[entry.id])) {
                data.gcs[entry.id][entry.key] = {
                  instance_type_data: {},
                  non_empty_instance_types: new Set(),
                  overall: 0
                };
              }
              if (entry.overall != 0) {
                var instance_type_name = entry.instance_type_name;
                var id = entry.id;
                var key = entry.key;
                keys.add(key);
                data.gcs[id][key].instance_type_data[instance_type_name] = {
                  "overall": entry.overall,
                  "count": entry.count,
                  "over_allocated": entry.over_allocated,
                  "overall_histogram" : entry.histogram,
                  "over_allocated_histogram": entry.over_allocated_histogram
                };
                data.gcs[id][key].overall += entry.overall;

                data.gcs[id][key].non_empty_instance_types.add(instance_type_name);
                data.gcs[id].non_empty_instance_types.add(instance_type_name);
                data.non_empty_instance_types.add(instance_type_name);
              }
            }
          } else if (entry.type === "bucket_sizes") {
            if (entry.id in data.gcs) {
              if (!(entry.key in data.gcs[entry.id])) {
                data.gcs[entry.id][entry.key] = {
                  instance_type_data: {},
                  non_empty_instance_types: new Set(),
                  overall: 0
                };
              }
              data.gcs[entry.id][entry.key].bucket_sizes = entry.sizes;
            }
          } else {
            console.log("Unknown entry type: " + entry.type);
          }
        }
        // Create a ranked instance type array that sorts instance types by memory size (overall).
        for (let gc in data.gcs) {
          for (let key of keys) {
            let data_set = data.gcs[gc][key];
            data_set.ranked_instance_types = [... data_set.non_empty_instance_types ];
            data_set.ranked_instance_types = data_set.ranked_instance_types.sort(function(a,b) {
              if (data_set.instance_type_data[a].overall > data_set.instance_type_data[b].overall) {
                return 1;
              } else if (data_set.instance_type_data[a].overall < data_set.instance_type_data[b].overall) {
                return -1;
              }
              return 0;
            });
          }
        }
        this.handleDone(data, true, file.name);
      }.bind(this)
      result.readAsText(file);
    } else { 
      console.log("Failed to load file");
    }
  },
  handleDone: function(data, failed, file_name) {
    this.setState({
      inner_text: "Finished loading '" + file_name + "'"
    });
    this.props.onNewData(data);
  },
  handleChange: function(event) {
    event.preventDefault();
    var host = event.dataTransfer ? event.dataTransfer : event.target;
    this.readFile(host.files[0]);
  },
  handleDragOver: function (event) {
    event.preventDefault();
  },
  handleClick: function(event) {
    this.refs.file.value = null
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
      display: "none",
    };
    return (
      <div style={dragDropStyle} onDragOver={this.handleDragOver} onDrop={this.handleChange} onClick={this.handleClick}>
        {this.state.inner_text}
        <input ref="file" type="file" name="file" onChange={this.handleChange} style={inputStyle} />
      </div>
    );
  }
});