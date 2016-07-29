import React from "react";

import TraceFileReader from "./trace-file-reader";  // eslint-disable-line no-unused-vars
import {AreaChart, BarChart, LineChart, PieChart} from "./basic-charts";  // eslint-disable-line no-unused-vars
import {CodeDetails, FixedArrayDetails} from "./components";  // eslint-disable-line no-unused-vars

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
      for (let instanceType of isolateData.nonEmptyInstanceTypes) {
        if (instanceType.startsWith("*")) continue;

        if (gcCount === 0) labels.push(instanceType);

        const instanceTypeData = perGCData[gc].live.instanceTypeData;
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

  mallocedData: function() {
    const isolateData = this.selectedIsolateData();
    if (isolateData === null) return null;
    const timesAsDoubles = Object.keys(isolateData.samples.malloced)
                               .map(e => parseFloat(e))
                               .sort((a, b) => a - b);
    const dataset = [];
    for (let i = 0; i < timesAsDoubles.length; i++) {
      const time = timesAsDoubles[i];
      dataset.push([time, isolateData.samples.malloced[time] / KB]);
    }
    const labels = ['Time [ms]', 'malloced'];
    return [labels, ... dataset];
  },

  timelineDataGrouped: function() {
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
          let instanceTypeData = perGCData[gc].live.instanceTypeData;
          if ((instanceType in instanceTypeData) &&
              (instanceTypeData[instanceType].overall > (perGCData[gc].live.overall * threshold))) {
            interestingInstanceTypesArray.push(instanceType);
            interestingInstanceTypes.add(instanceType);
          }
        }

        for (let instanceType of isolateData.nonEmptyInstanceTypes) {
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
        const instanceTypeData = perGCData[gc].live.instanceTypeData;
        if (instanceType in instanceTypeData) {
          dataset[gcCount].push(instanceTypeData[instanceType].overall / KB);
        } else {
          dataset[gcCount].push(0);
        }
      }

      for (let instanceType of nonInterestingInstanceTypes) {
        const instanceTypeData = perGCData[gc].live.instanceTypeData;
        if (instanceType in instanceTypeData) {
          other += instanceTypeData[instanceType].overall / KB;
        }
      }
      dataset[gcCount].push(other);
      if (gcCount === 0) {
        labels.push('Other');
      }
      gcCount++;
    }
    return [labels, ...dataset];
  },

  _rawData: function(key, header, selector, nameCallback, valueCallback) {
    const gcData = this.selectedGCData();
    if (gcData === null) return null;

    const dataset = [['InstanceType', ...header]];
    for (let entry of gcData[key].nonEmptyInstanceTypes) {
      if (selector(entry)) {
        dataset.push([nameCallback(entry),
                      ...valueCallback(gcData[key].instanceTypeData[entry])]);
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
    if (!(instanceType in gcData[key].instanceTypeData)) return emptyResponse;
    return gcData[key].instanceTypeData[instanceType];
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

  instanceTypeSizeData: function(instanceType, key) {
    if (instanceType === null) return null;
    const selectedGCData = this.selectedGCData();
    if (selectedGCData === null) return null;

    const bucketLabels = selectedGCData[key].bucketSizes;
    const bucketSizes = selectedGCData[key]
      .instanceTypeData[instanceType].overallHistogram;
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
      hAxis: {
        title: "Time [ms]",
        minValue: this.selectedIsolateData() === null ? 0 : this.selectedIsolateData().start,
        maxValue: this.selectedIsolateData() === null ? 0 : this.selectedIsolateData().end
      },
      vAxis: {title: "Memory consumption [KBytes]"},
      chartArea: {
        width: "90%",
        height: "80%"
      },
      legend: {
        position: "top",
        maxLines: "2"
      }
    };
    const mallocedOptions = {
      pointsVisible: false,
      hAxis: {
        ticks: [],
        minValue: this.selectedIsolateData() === null ? 0 : this.selectedIsolateData().start,
        maxValue: this.selectedIsolateData() === null ? 0 : this.selectedIsolateData().end
      },
      vAxis: {title: "Memory consumption [KBytes]"},
      chartArea: {
        width: "90%",
        height: "80%"
      },
      legend: {position: 'none'}
    };
    const instanceTypeSizeOptions = {
      title: 'Size Histogram',
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
        <AreaChart ref="timelineChart"
                   chartData={this.timelineDataGrouped()}
                   chartStyle={timelineStyle}
                   chartOptions={timelineOptions}
                   handleSelection={this.handleSelection} />
        <div style={{display: this.state.showMalloced ? "inline" : "none"}} >
          <LineChart ref="mallocedLineChart"
                     chartData={this.mallocedData()}
                     chartStyle={timelineStyle}
                     chartOptions={mallocedOptions} />
        </div>
        </div>

        <div style={{display: this.selectedInstanceType() === null ? "none" : "inline"}}>
          <h2>Details: <tt>{this.typeName(this.selectedInstanceType())}</tt></h2>
          <div ref="instance_type_size_distribution" style={null}>
            <div style={{width: '50%', float: 'left'}}>
              <h3 style={{textAlign: 'center'}}>Live</h3>
              <ul>
                <li>Overall memory consumption: {this.selectedInstanceTypeData("live").overall / KB} KB</li>
                <li>Overall count: {this.selectedInstanceTypeData("live").count}</li>
              </ul>
              <BarChart chartData={this.instanceTypeSizeData(this.selectedInstanceType(), "live")}
                        chartOptions={instanceTypeSizeOptions}
                        chartStyle={{height: instanceTypeSizeHeight, margin: '30px'}} />
            </div>
            <div style={{width: '50%', float: 'left'}}>
              <h3 style={{textAlign: 'center'}}>Dead</h3>
              <ul>
                <li>Overall memory consumption: {this.selectedInstanceTypeData("dead").overall / KB} KB</li>
                <li>Overall count: {this.selectedInstanceTypeData("dead").count}</li>
              </ul>
              <BarChart chartData={this.instanceTypeSizeData(this.selectedInstanceType(), "dead")}
                        chartOptions={instanceTypeSizeOptions}
                        chartStyle={{height: instanceTypeSizeHeight, margin: '30px'}} />
            </div>
          </div>
        </div>

        <FixedArrayDetails show={this.selectedInstanceType() === "FIXED_ARRAY_TYPE"}
                           data={this.selectedGCData()} />

        <CodeDetails show={this.selectedInstanceType() === "CODE_TYPE"}
                     data={this.selectedGCData()} />

      </div>
    );
  }
});
