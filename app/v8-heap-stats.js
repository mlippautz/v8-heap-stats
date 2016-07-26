import React from "react";

import TraceFileReader from "./trace-file-reader";  // eslint-disable-line no-unused-vars
import {AreaChart, BarChart, PieChart} from "./basic-charts";  // eslint-disable-line no-unused-vars

const KB = 1024;

export default React.createClass({
  getInitialState: function() {
    return {
      data: null,
      threshold: 0.01,

      selectedIsolate: null,
      selectedGC: null,
      selectedInstanceType: null,

      showMalloced: false
    };
  },

  handleNewData: function(data) {
    let firstIsolate;
    for (const isolate of Object.keys(data)) {
      firstIsolate = isolate;
      break;
    }

    this.setState({
      data: data,
      threshold: this.state.threshold,

      selectedIsolate: firstIsolate,
      selectedGC: null,
      selectedInstanceType: null,

      showMalloced: false
    });
  },

  handleIsolateChange: function(e) {
    console.log("Selected isolate: " + e.target.value);
    this.setState({
      data: this.state.data,
      threshold: this.state.threshold,

      selectedIsolate: e.target.value,
      selectedGC: null,
      selectedInstanceType: null,

      showMalloced: false
    });
  },

  selectedIsolateData: function() {
    if (this.state.data === null) return null;
    return this.state.data[this.state.selectedIsolate];
  },

  timelineData: function() {
    const isolateData = this.selectedIsolateData();
    if (isolateData === null) return null;
    const perGCData = isolateData.gcs;
    const dataset = [];
    const labels = ['Time [ms]'];
    let gcCount = 0;
    for (let gc of Object.keys(perGCData)) {
      dataset[gcCount] = [perGCData[gc].time];
      for (let instanceType of isolateData.non_empty_instance_types) {
        if (instanceType.startsWith("*")) continue;

        if (gcCount === 0) labels.push(instanceType);

        const instanceTypeData = perGCData[gc].live.instance_type_data;
        if (instanceType in instanceTypeData) {
          dataset[gcCount].push(instanceTypeData[instanceType].overall);
        } else {
          dataset[gcCount].push(0);
        }
      }
      gcCount++;
    }
    return [labels, ...dataset];
  },

  timelineDataGrouped: function(options) {
    if (options === null || options === undefined) {
      options = {
        showMalloced: false
      };
    }
    const isolateData = this.selectedIsolateData();
    if (isolateData === null) return null;
    const perGCData = isolateData.gcs;
    let dataset = [];
    const labels = ['Time [ms]'];
    let gcCount = 0;

    let threshold = parseFloat(this.state.threshold);
    if (isNaN(threshold))
      threshold = 0;

    const interestingInstanceTypesArray = [];
    const interestingInstanceTypes = new Set();
    const nonInterestingInstanceTypes = new Set();
    for (let gc in perGCData) {
      if (gcCount === 0) {
        for (let i = 0;
             i < perGCData[gc].live.rankedInstanceTypes.length;
             i++) {
          const instanceType = perGCData[gc].live.rankedInstanceTypes[i];
          if (instanceType.startsWith("*")) continue;
          let instanceTypeData = perGCData[gc].live.instance_type_data;
          if ((instanceType in instanceTypeData) &&
              (instanceTypeData[instanceType].overall > (perGCData[gc].live.overall * threshold))) {
            interestingInstanceTypesArray.push(instanceType);
            interestingInstanceTypes.add(instanceType);
          }
        }

        for (let instanceType of isolateData.non_empty_instance_types) {
          if (instanceType.startsWith("*")) continue;
          if (!interestingInstanceTypes.has(instanceType)) {
            nonInterestingInstanceTypes.add(instanceType);
          }
        }
      }

      let other = 0;
      dataset[gcCount] = [perGCData[gc].time];
      for (let i = 0; i < interestingInstanceTypesArray.length; i++) {
        const instanceType = interestingInstanceTypesArray[i];
        if (gcCount === 0) labels.push(instanceType);
        const instanceTypeData = perGCData[gc].live.instance_type_data;
        if (instanceType in instanceTypeData) {
          dataset[gcCount].push(instanceTypeData[instanceType].overall / KB);
        } else {
          dataset[gcCount].push(0);
        }
      }

      for (let instanceType of nonInterestingInstanceTypes) {
        const instanceTypeData = perGCData[gc].live.instance_type_data;
        if (instanceType in instanceTypeData) {
          other += instanceTypeData[instanceType].overall / KB;
        }
      }
      dataset[gcCount].push(other);
      if (options.showMalloced) dataset[gcCount].push(perGCData[gc].malloced / KB);
      if (gcCount === 0) {
        labels.push('Other');
        if (options.showMalloced) labels.push('malloced');
      }
      gcCount++;
    }
    return [labels, ...dataset];
  },

  _rawData: function(key, header, selector, nameCallback, valueCallback) {
    const gcData = this.selectedGCData();
    if (gcData === null) return null;

    const dataset = [['InstanceType', ...header]];
    for (let entry of gcData[key].non_empty_instance_types) {
      if (selector(entry)) {
        dataset.push([nameCallback(entry),
                      ...valueCallback(gcData[key].instance_type_data[entry])]);
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

  selectedInstanceTypeData: function(key) {
    const emptyResponse = {
      overall: 0
    };

    const instanceType = this.selectedInstanceType();
    const gcData = this.selectedGCData();
    if (gcData === null || instanceType === null) return emptyResponse;
    if (!(instanceType in gcData[key].instance_type_data)) return emptyResponse;
    return gcData[key].instance_type_data[instanceType];
  },

  fixedArraySubTypeName: function(fullName) {
    if (fullName === null) return null;
    return fullName.slice("*FIXED_ARRAY_".length)
                   .slice(0, -("_SUB_TYPE".length));
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
      value => value === undefined ?
        [0, 0] :
        [value.overall - value.over_allocated, value.over_allocated]
      );
  },

  instanceTypeSizeData: function(instanceType, key) {
    if (instanceType === null) return null;
    const selectedGCData = this.selectedGCData();
    if (selectedGCData === null) return null;

    const bucketLabels = selectedGCData[key].bucket_sizes;
    const bucketSizes = selectedGCData[key]
      .instance_type_data[instanceType].overall_histogram;
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
      selectedInstanceType: this.state.selectedInstanceType,

      showMalloced: false
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

  handleShowMallocedChange: function(e) {
    this.setState({
      data: this.state.data,
      threshold: this.state.threshold,

      selectedGC: this.state.selectedGC,
      selectedInstanceType: this.state.selectedInstanceType,
      selectedIsolate: this.state.selectedIsolate,

      showMalloced: e.target.checked
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
      pointSize: 7,
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
    const fixedArrayDetailsStyle = {
      display: this.selectedInstanceType() === "FIXED_ARRAY_TYPE" ?
        "inline" : "none"
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
          Visualize object stats gathered using
          <tt>--trace-gc-object-stats</tt>.
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
The plot shows the memory consumption for each instance type over time. Each
data point corresponds to a sample collected during a major GC. Lines stack,
i.e., the top line shows the overall memory consumption. Select a data point
to inspect details.
        </p>
        <ul>
          <li>
InstanceType threshold:
<input ref="threshold" type="text" value={this.state.threshold} onChange={this.handleThresholdChange} />
          </li>
          <li>
Show malloced memory:
<input type="checkbox" checked={this.state.showMalloced} onChange={this.handleShowMallocedChange} />
          </li>
        </ul>
        <AreaChart chartData={this.timelineDataGrouped({showMalloced: this.state.showMalloced})}
                   chartStyle={timelineStyle}
                   chartOptions={timelineOptions}
                   handleSelection={this.handleSelection} />
        </div>

        <div style={{display: this.selectedInstanceType() === null ? "none" : "inline"}}>
          <h2>Size Histogram: <tt>{this.typeName(this.selectedInstanceType())}</tt></h2>
          <p>
            Plot shows the size histogram for the selected instance type.
          </p>
          <div ref="instance_type_size_distribution" style={null}>
            <div style={{width: '50%', float: 'left'}}>
              <h3 style={{textAlign: 'center'}}>Live</h3>
              <p>
                Overall memory consumption: {this.selectedInstanceTypeData("live").overall / KB} KB
              </p>
              <BarChart chartData={this.instanceTypeSizeData(this.selectedInstanceType(), "live")}
                        chartOptions={instanceTypeSizeOptions}
                        chartStyle={{height: instanceTypeSizeHeight, margin: '30px'}} />
            </div>
            <div style={{width: '50%', float: 'left'}}>
              <h3 style={{textAlign: 'center'}}>Dead</h3>
              <p>
                Overall memory consumption: {this.selectedInstanceTypeData("dead").overall / KB} KB
              </p>
              <BarChart chartData={this.instanceTypeSizeData(this.selectedInstanceType(), "dead")}
                        chartOptions={instanceTypeSizeOptions}
                        chartStyle={{height: instanceTypeSizeHeight, margin: '30px'}} />
            </div>
          </div>
        </div>

        <div style={{display: this.selectedGCData() === null ? "none" : "inline"}}>
          <div style={fixedArrayDetailsStyle} >
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

      </div>
    );

    /* Unused:

        <h2>InstanceType Distribution</h2>
        <div ref="instance_type_distribution" style={instanceTypeDistributionStyle}>
          <PieChart chartData={this.instanceTypeData("live")}
                    chartOptions={null}
                    chartStyle={instanceTypeDistributionChartStyle} />
          <PieChart chartData={this.instanceTypeData("dead")}
                    chartOptions={null}
                    chartStyle={instanceTypeDistributionChartStyle} />
        </div>

    */
  }
});
