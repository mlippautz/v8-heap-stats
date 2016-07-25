import React from "react";

import TraceFileReader from "./trace-file-reader";
import {AreaChart, BarChart, PieChart} from "./basic-charts";

let KB = 1024;
let MB = 1024 * KB;

export default React.createClass({
  getInitialState: function() {
    return {
      data: null,
      threshold: 0.01,

      selectedIsolate: null,
      selectedGC: null,
      selectedInstanceType: null
    };
  },

  handleNewData: function(data) {
    let first_isolate;
    for (const isolate in data) {
      first_isolate = isolate;
      break;
    }

    this.setState({
      data: data,
      threshold: this.state.threshold,

      selectedIsolate: first_isolate,
      selectedGC: null,
      selectedInstanceType: null
    });
  },

  handleIsolateChange: function(e) {
    console.log("Selected isolate: " + e.target.value);
    this.setState({
      data: this.state.data,
      threshold: this.state.threshold,

      selectedIsolate: e.target.value,
      selectedGC: null,
      selectedInstanceType: null
    });
  },

  selectedIsolateData: function() {
    if (this.state.data === null) return null;
    return this.state.data[this.state.selectedIsolate];
  },

  timelineData: function() {
    const isolate_data = this.selectedIsolateData();
    if (isolate_data === null) return null;
    const per_gc_data = isolate_data.gcs;
    const dataset = [];
    const labels = ['Time [ms]'];
    let gc_count = 0;
    for (let gc in per_gc_data) {
      dataset[gc_count] = [per_gc_data[gc].time];
      for (let instance_type of isolate_data.non_empty_instance_types) {
        if (instance_type.startsWith("*")) continue;

        if (gc_count === 0) labels.push(instance_type);

        var instance_type_data = per_gc_data[gc].live.instance_type_data;
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

  timelineDataGrouped: function() {
    const isolate_data = this.selectedIsolateData();
    if (isolate_data === null) return null;
    const per_gc_data = isolate_data.gcs;
    let dataset = [];
    let labels = ['Time [ms]'];
    let gcCount = 0;

    let threshold = parseFloat(this.state.threshold);
    if (isNaN(threshold))
      threshold = 0;

    let interesting_instance_types_array = [];
    let interesting_instance_types = new Set();
    let non_interesting_instance_types = new Set();
    for (let gc in per_gc_data) {
      if (gcCount === 0) {
        for (let key in per_gc_data[gc].live.ranked_instance_types) {
          let instance_type = per_gc_data[gc].live.ranked_instance_types[key];
          if (instance_type.startsWith("*")) continue;
          var instance_type_data = per_gc_data[gc].live.instance_type_data;
          if ((instance_type in instance_type_data) &&
              (instance_type_data[instance_type].overall > (per_gc_data[gc].live.overall * threshold))) {
            interesting_instance_types_array.push(instance_type);
            interesting_instance_types.add(instance_type);
          }
        }

        for (let instance_type of isolate_data.non_empty_instance_types) {
          if (instance_type.startsWith("*")) continue;
          if (!interesting_instance_types.has(instance_type)) {
            non_interesting_instance_types.add(instance_type);
          }
        }
      }

      let other = 0;
      dataset[gcCount] = [per_gc_data[gc].time];
      for (let key in interesting_instance_types_array) {
        let instance_type = interesting_instance_types_array[key];
        if (gcCount === 0) labels.push(instance_type);
        var instance_type_data = per_gc_data[gc].live.instance_type_data;
        if (instance_type in instance_type_data) {
          dataset[gcCount].push(instance_type_data[instance_type].overall / KB);
        } else {
          dataset[gcCount].push(0);
        }
      }

      for (let instance_type of non_interesting_instance_types) {
        var instance_type_data = per_gc_data[gc].live.instance_type_data;
        if (instance_type in instance_type_data) {
          other += instance_type_data[instance_type].overall/KB;
        }
      }
      dataset[gcCount].push(other);
      if (gcCount === 0) labels.push('Other');
      gcCount++;
    }
    return [labels, ...dataset];
  },

  _rawData: function(key, header, selector, name_callback, value_callback) {
    const gcData = this.selectedGCData();
    if (gcData === null) return null;

    const dataset = [['InstanceType', ...header]];
    for (let entry of gcData[key].non_empty_instance_types) {
      if (selector(entry)) {
        dataset.push([name_callback(entry),
                      ...value_callback(gcData[key].instance_type_data[entry])]);
      }
    }
    return dataset;
  },

  selectedGCData: function() {
    const isolateData = this.selectedIsolateData();
    if (isolateData === null) return null;
    if (this.state.selectedGC === null) return null;
    return isolateData.gcs[this.state.selectedGC];
  },

  selectedInstanceType: function() {
    if (this.state.selectedInstanceType === null) return null;
    return this.state.selectedInstanceType;
  },


  fixedArraySubTypeName: function(fullName) {
    if (fullName === null) return null;
    return fullName.slice("*FIXED_ARRAY_".length).slice(0, -("_SUB_TYPE".length));
  },

  typeName: function(fullName) {
    if (fullName === null) return null;
    return fullName.slice(0, -("_TYPE".length));
  },

  instanceTypeData: function(key) {
    let ds = this._rawData(
      key,
      ['Memory consumption [Bytes]'],
      name => !name.startsWith("*"),
      name => this.typeName(name),
      value => value === undefined ? 0 : [value.overall]);
    return ds;
  },

  fixedArrayData: function(key) {
    let ds = this._rawData(
      key,
      ['Memory consumption [Bytes]'],
      name => name.startsWith("*FIXED_ARRAY_"),
      name => this.fixedArraySubTypeName(name),
      value => value === undefined ? 0 : [value.overall]);
    return ds;
  },

  fixedArrayOverheadData: function(key) {
    return this._rawData(
      key,
      ['Payload [Bytes]', 'Overhead [Bytes]'],
      name => name.startsWith("*FIXED_ARRAY_"),
      name => this.fixedArraySubTypeName(name),
      value => value === undefined ? [0, 0] : [value.overall - value.over_allocated, value.over_allocated]
      );
  },

  instanceTypeSizeData: function(instance_type, key) {
    if (instance_type === null) return null;
    const selectedGCData = this.selectedGCData();
    if (selectedGCData === null) return null;

    const bucketLabels = selectedGCData[key].bucket_sizes;
    const bucketSizes = selectedGCData[key]
      .instance_type_data[instance_type].overall_histogram;
    const labels = ['Bucket', 'Count'];
    const data = [];
    for (let i = 0; i < bucketSizes.length; i++) {
      data.push(['<' + bucketLabels[i], bucketSizes[i]]);
    }
    return [labels, ...data];
  },

  handleThresholdChange: function(e) {
    this.setState({
      data: this.state.data,
      threshold: e.target.value,
      selectedGC: this.state.selectedGC,
      selectedInstanceType: this.state.selectedInstanceType
    });
  },

  handleSelection: function(a, b) {
    console.log("selected: " + a + ", " + b);

    if (b === "Other") b = null;

    let selected = null;
    for (let gc in this.selectedIsolateData().gcs) {
      if (this.selectedIsolateData().gcs[gc].time === a) {
        selected = gc;
        break;
      }
    }

    this.setState({
      data: this.state.data,
      threshold: this.state.threshold,
      selectedGC: selected,
      selectedInstanceType: b,
      selectedIsolate: this.state.selectedIsolate
    });
  },

  render: function() {
    const timelineStyle = {
      width: "90%",
      height: "600px",
      margin: 'auto'
    };
    const timelineOptions = {
      isStacked: true,
      pointsVisible: true,
      pointSize: 3,
      hAxis: {title: "Time [ms]"},
      vAxis: {title: "Memory consumption [KBytes]"}
    };
    const instanceTypeDistributionStyle = {
      height: "600px",
      width: "100%"
    };
    const instanceTypeDistributionChartStyle = {
      width: "50%",
      height: "600px",
      float: "left"
    };
    const fixedArrayOverheadStyle = {
      height: "600px",
      width: "100%"
    };
    const fixedArrayOverheadChartStyle = {
      width: "50%",
      height: "600px",
      float: "left"
    };
    const fixedArrayOverheadOptions = {
      vAxis: {
        textStyle: {fontSize: 10}
      },
      isStacked: true,
      bars: 'horizontal',
      series: {
        0: {color: '#3366CC'},
        1: {color: '#DC3912'}
      }
    };

    const instanceTypeSizeOptions = {
      bars: 'vertical',
      legend: {position: 'none'}
    };
    const instanceTypeSizeHeight = "300px";

    const isolateOptions = this.state.data === null ?
        (<option>Load some data first...</option>) :
        Object.keys(this.state.data).map(function(option) {
          return (
            <option key={option} value={option}>{option}</option>
          );
        });

    return (
      <div >
        <TraceFileReader onNewData={this.handleNewData} />
        <h1>V8 Heap Statistics</h1>

        <p style={{clear: "both"}}>
          Visualize object stats gathered using <tt>--trace-gc-object-stats</tt>.
        </p>

        <p>
          Isolate
          <select
              disabled={ this.state.data === null ? "disabled" : "" }
              style={{marginLeft: "10px", verticalAlign: "middle"}}
              onChange={this.handleIsolateChange}>
            {isolateOptions}
          </select>
        </p>

        <div style={{display: this.state.data === null ? "none" : "inline"}}>
        <h2>
          Timeline
        </h2>
        <p>
          The plot shows the memory consumption for each instance type over time. Each data point corresponds to a sample
          collected during a major GC. Lines stack, i.e., the top line shows the overall memory consumption.
          Select a data point to inspect details.
        </p>
        <p>
          Threshold for single InstanceType: <input ref="threshold" type="text" value={this.state.threshold} onChange={this.handleThresholdChange} />.
          The threshold determines which values to fold into the 'Other' category.
        </p>
        <AreaChart chartData={this.timelineDataGrouped()}
                   chartStyle={timelineStyle}
                   chartOptions={timelineOptions}
                   handleSelection={this.handleSelection} />
        </div>

        <div style={{display: this.selectedInstanceType() === null ? "none" : "inline"}}>
          <h2><tt>{this.typeName(this.selectedInstanceType())}</tt> Size Histogram</h2>
          <p>
            Plot shows the size histogram for the selected instance type.
          </p>
          <div ref="instance_type_size_distribution" style={null}>
            <div style={{width: '50%', float: 'left'}}>
              <h3 style={{textAlign: 'center'}}>Live</h3>
              <BarChart chartData={this.instanceTypeSizeData(this.selectedInstanceType(), "live")}
                        chartOptions={instanceTypeSizeOptions}
                        chartStyle={{height: instanceTypeSizeHeight, margin: '30px'}} />
            </div>
            <div style={{width: '50%', float: 'left'}}>
              <h3 style={{textAlign: 'center'}}>Dead</h3>
              <BarChart chartData={this.instanceTypeSizeData(this.selectedInstanceType(), "dead")}
                        chartOptions={instanceTypeSizeOptions}
                        chartStyle={{height: instanceTypeSizeHeight, margin: '30px'}} />
            </div>
          </div>
        </div>

        <div style={{display: this.selectedGCData() === null ? "none" : "inline"}}>
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
        </div>


      </div>
    );
  },
});
