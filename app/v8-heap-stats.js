import React from "react";

import TraceFileReader from "./trace-file-reader"
import {AreaChart, BarChart, PieChart} from "./basic-charts"

export default React.createClass({
  getInitialState: function() {
    return {
      data: null,
      threshold: 0.01,
      selected: null,
      selected_instance_type: null,
    };
  },
  handleNewData: function(data) {
    this.setState({data: data});
  },

  timelineData:function() {
    if (this.state.data == null) return null;
    let per_gc_data = this.state.data.gcs;
    let dataset = [];
    let labels = ['Time [ms]'];
    let gc_count = 0;
    for (let gc in per_gc_data) {
      dataset[gc_count] = [ per_gc_data[gc].time ]
      for (let instance_type of this.state.data.non_empty_instance_types) {
        if (instance_type.startsWith("*")) continue;

        if (gc_count == 0) labels.push(instance_type);

        var instance_type_data = per_gc_data[gc]["live"].instance_type_data;
        if (instance_type in instance_type_data) {
          dataset[gc_count].push(instance_type_data[instance_type].overall);
        } else {
          dataset[gc_count].push(0);
        }
      }
      gc_count++;
    }
    return [labels, ...dataset];
  },

  timelineDataGrouped:function() {
    if (this.state.data == null) return null;
    let per_gc_data = this.state.data.gcs;
    let dataset = [];
    let labels = ['Time [ms]'];
    let gc_count = 0;

    let threshold = parseFloat(this.state.threshold);
    if (isNaN(threshold))
      threshold = 0;

    let interesting_instance_types_array = [];
    let interesting_instance_types = new Set();
    let non_interesting_instance_types = new Set();
    for (let gc in per_gc_data) {

      if (gc_count == 0) {
        for (let key in per_gc_data[gc]["live"].ranked_instance_types) {
          let instance_type = per_gc_data[gc]["live"].ranked_instance_types[key];
          if (instance_type.startsWith("*")) continue;
          var instance_type_data = per_gc_data[gc]["live"].instance_type_data;
          if ((instance_type in instance_type_data) && 
              (instance_type_data[instance_type].overall > (per_gc_data[gc]["live"].overall * threshold))) {
            interesting_instance_types_array.push(instance_type);
            interesting_instance_types.add(instance_type);
          }
        }

        for (let instance_type of this.state.data.non_empty_instance_types) {
          if (instance_type.startsWith("*")) continue;
          if (!interesting_instance_types.has(instance_type)) {
            non_interesting_instance_types.add(instance_type);
          }
        }
      }

      let other = 0;
      dataset[gc_count] = [ per_gc_data[gc].time ]
      for (let key in interesting_instance_types_array) {
        let instance_type = interesting_instance_types_array[key];
        if (gc_count == 0) labels.push(instance_type);
        var instance_type_data = per_gc_data[gc]["live"].instance_type_data;
        if (instance_type in instance_type_data) {
          dataset[gc_count].push(instance_type_data[instance_type].overall);
        } else {
          dataset[gc_count].push(0);
        }
      }

      for (let instance_type of non_interesting_instance_types) {
        var instance_type_data = per_gc_data[gc]["live"].instance_type_data;
        if (instance_type in instance_type_data) {
          other += instance_type_data[instance_type].overall;
        }
      }
      dataset[gc_count].push(other);
      if (gc_count == 0) labels.push('Other');
      gc_count++;
    }
    return [labels, ...dataset];
  },

  _rawData: function(key, header, selector, name_callback, value_callback) {
    let data = this.selectedGCData();
    if (data == null) return null;

    let dataset = [['InstanceType', ...header]];
    for (let entry of data[key].non_empty_instance_types) {
      if (selector(entry)) {
        dataset.push([name_callback(entry),
                      ...value_callback(data[key].instance_type_data[entry])]);
      }
    }
    return dataset;
  },

  selectedGCData: function() {
    if (this.state.data == null) return null;
    if (this.state.selected == null) return null;

    return this.state.data.gcs[this.state.selected];
  },

  selectedInstanceType: function() {
    if (this.state.selected_instance_type == null) return null;
    return this.state.selected_instance_type;
  },


  fixedArraySubTypeName: function(full_name) {
    return full_name.slice("*FIXED_ARRAY_".length).slice(0, -("_SUB_TYPE".length));
  },

  typeName: function(full_name) {
    return full_name.slice(0, -("_TYPE".length));
  },

  instanceTypeData: function(key) {
    let ds = this._rawData(
      key,
      ['Memory consumption [Bytes]'],
      (name) => !name.startsWith("*"),
      (name) => this.typeName(name),
      (value) => value == undefined ? 0 : [value.overall]);
    return ds;
  },

  fixedArrayData: function(key) {
    let ds = this._rawData(
      key,
      ['Memory consumption [Bytes]'],
      (name) => name.startsWith("*FIXED_ARRAY_"),
      (name) => this.fixedArraySubTypeName(name),
      (value) => value == undefined ? 0 : [value.overall]);
    return ds;
  },


  fixedArrayOverheadData: function(key) {
    return this._rawData(
      key,
      ['Payload [Bytes]', 'Overhead [Bytes]'],
      (name) => name.startsWith("*FIXED_ARRAY_"),
      (name) => this.fixedArraySubTypeName(name),
      (value) => value == undefined ? [0,0] : [value.overall - value.over_allocated, value.over_allocated]
      );
  },

  instanceTypeSizeData: function(instance_type, key) {
    let selected_gc_data = this.selectedGCData();
    if (selected_gc_data == null) return null;

    let bucket_labels = selected_gc_data[key].bucket_sizes;
    let bucket_sizes = selected_gc_data[key].instance_type_data[instance_type].overall_histogram;

    let labels = ['Bucket', 'Count'];
    let data = [];
    for (let i = 0; i < bucket_sizes.length; i++) {
      data.push(['<' + bucket_labels[i], bucket_sizes[i]]);
    }
    return [labels, ...data];
  },

  handleThresholdChange: function(e) {
    this.setState({
      data: this.state.data,
      threshold: e.target.value,
      selected: this.state.selected,
      selected_instance_type: this.state.selected_instance_type
    });
  },

  handleSelection: function(a,b) {
    console.log("selected: " + a + ", " + b)

    let selected = null;
    for (let gc in this.state.data.gcs) {
      if (this.state.data.gcs[gc].time == a) {
        selected = gc;
        break;
      }
    }

    this.setState({
      data: this.state.data,
      threshold: this.state.threshold,
      selected: selected,
      selected_instance_type: b
    });
  },

  render: function() {
    let timelineStyle = {
      width: "100%",
      height: "600px"
    };
    let timelineOptions = {
      isStacked: true,
      pointsVisible: true,
      pointSize: 3,
    };
    let instanceTypeDistributionStyle = {
      height: "600px",
      width: "100%"
    };
    let instanceTypeDistributionChartStyle= {
      width: "50%",
      height: "600px",
      float: "left",
    };
    let fixedArrayOverheadStyle = {
      height: "600px",
      width: "100%"
    };
    let fixedArrayOverheadChartStyle = {
      width: "50%",
      height: "600px",
      float: "left",
    };
    let fixedArrayOverheadOptions = {
      vAxis: {
        textStyle: {
          fontSize: 10
        }
      },
      isStacked: true,
      bars: 'horizontal',
      series: {
            0: { color: '#3366CC' },
            1: { color: '#DC3912' }
      },
    };
    let instanceTypeSizeOptions = {
      bars: 'vertical'
    };
    let instanceTypeSizeChartStyle = {
      width: "50%",
      height: "300px",
      float: "left",
    };
    let instanceTypeSizeStyle = {
      width: "100%",
      height: "300px"
    };
    return (
      <div >
        <TraceFileReader onNewData={this.handleNewData} />
        <h1>V8 Heap Statistics</h1>
        <p>
          Visualize object stats gathered using <tt>--trace-gc-object-stats</tt>.
        </p>
        <h2>Timeline</h2>
        Threshold for single InstanceType <input ref="threshold" type="text" value={this.state.threshold} onChange={this.handleThresholdChange} />
        <AreaChart chartData={this.timelineDataGrouped()}
                   chartStyle={timelineStyle}
                   chartOptions={timelineOptions}
                   handleSelection={this.handleSelection} />
        <h2>InstanceType Distribution</h2>
        <div ref="instance_type_distribution" style={instanceTypeDistributionStyle}>
          <PieChart chartData={this.instanceTypeData("live")}
                    chartOptions={null} 
                    chartStyle={instanceTypeDistributionChartStyle} />
          <PieChart chartData={this.instanceTypeData("dead")}
                    chartOptions={null}
                    chartStyle={instanceTypeDistributionChartStyle} />
        </div>
        <h2>FixedArray Distribution</h2>
        <div ref="fixed_array_distribution" style={instanceTypeDistributionStyle}>
          <PieChart chartData={this.fixedArrayData("live")}
                    chartOptions={null}
                    chartStyle={instanceTypeDistributionChartStyle} />
          <PieChart chartData={this.fixedArrayData("dead")}
                    chartOptions={null}
                    chartStyle={instanceTypeDistributionChartStyle} />
        </div>
        <h2>FixedArray Overhead</h2>
        <div ref="fixed_array_overhead" style={fixedArrayOverheadStyle}>
          <BarChart chartData={this.fixedArrayOverheadData("live")}
                    chartOptions={fixedArrayOverheadOptions}
                    chartStyle={fixedArrayOverheadChartStyle} />
          <BarChart chartData={this.fixedArrayOverheadData("dead")}
                    chartOptions={fixedArrayOverheadOptions}
                    chartStyle={fixedArrayOverheadChartStyle} />
        </div>
        <h2>InstanceType Size Histogram</h2>
          <p>Selected InstanceType: {this.selectedInstanceType()}</p>
          <div ref="instance_type_size_distribution" style={instanceTypeSizeStyle}>
          <BarChart chartData={this.instanceTypeSizeData(this.selectedInstanceType(), "live")}
                    chartOptions={instanceTypeSizeOptions}
                    chartStyle={instanceTypeSizeChartStyle} />
          <BarChart chartData={this.instanceTypeSizeData(this.selectedInstanceType(), "dead")}
                    chartOptions={instanceTypeSizeOptions}
                    chartStyle={instanceTypeSizeChartStyle} />
        </div>
      </div>
    );
  },
});