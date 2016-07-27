import React from "react";
import {AreaChart, BarChart, LineChart, PieChart} from "./basic-charts";  // eslint-disable-line no-unused-vars
import {Colors} from "./utils";  // eslint-disable-line no-unused-vars

function rawDataTransform(
    gcData, key, header, selector, nameCallback, valueCallback) {
  const dataset = [['InstanceType', ...header]];
  for (let entry of gcData[key].nonEmptyInstanceTypes) {
    if (selector(entry)) {
      dataset.push([nameCallback(entry),
                    ...valueCallback(gcData[key].instanceTypeData[entry])]);
    }
  }
  return dataset;
}

var FixedArrayDetails = React.createClass({
  getInitialState: function() {
    return {
      selectedSubType: null
    };
  },

  subTypeName: function(fullName) {
    if (fullName === null) return null;
    return fullName.slice("*FIXED_ARRAY_".length)
                   .slice(0, -("_SUB_TYPE".length));
  },

  fixedArrayData: function(key) {
    if (this.props.data === null) return null;
    const colors = [];
    const data = rawDataTransform(this.props.data,
      key,
      ['Memory consumption [Bytes]'],
      name => name.startsWith("*FIXED_ARRAY_"),
      name => {
        colors.push(Colors.getColor(name));
        return this.subTypeName(name);
      },
      value => value === undefined ? 0 : [value.overall]);
    return {data: data, colors: colors};
  },

  fixedArraySubTypeData: function(key) {
    if (this.props.data === null) return null;
    if (this.state.selectedSubType === null) return null;
    const selectedGCData = this.props.data;
    const instanceType = this.state.selectedSubType;

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

  fixedArrayOverheadSubTypeData: function(key) {
    if (this.props.data === null) return null;
    if (this.state.selectedSubType === null) return null;
    const selectedGCData = this.props.data;
    const instanceType = this.state.selectedSubType;

    const bucketLabels = selectedGCData[key].bucketSizes;
    const bucketSizes = selectedGCData[key]
      .instanceTypeData[instanceType].overAllocatedHistogram;
    const labels = ['Bucket', 'Count'];
    const data = [];
    for (let i = 0; i < bucketSizes.length; i++) {
      data.push(['<' + bucketLabels[i], bucketSizes[i]]);
    }
    return [labels, ...data];
  },

  fixedArrayOverheadData: function(key) {
    if (this.props.data === null) return null;
    return rawDataTransform(this.props.data,
      key,
      ['Payload [Bytes]', 'Overhead [Bytes]'],
      name => name.startsWith("*FIXED_ARRAY_"),
      name => this.subTypeName(name),
      value => value === undefined ?
        [0, 0] :
        [value.overall - value.overAllocated, value.overAllocated]
      );
  },

  handleSelection: function(item) {
    console.log("Selected fixed array sub type: " + item);
    this.setState({
      selectedSubType: "*FIXED_ARRAY_" + item + "_SUB_TYPE"
    });
  },

  render: function() {
    const subComponentStyle = {
      height: "600px",
      width: "100%"
    };
    const chartStyle = {
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
    const subTypeOptions = {
      bars: 'vertical',
      legend: {position: 'none'}
    };
    return (
      <div style={{display: this.props.show ? "inline" : "none"}} >
        <h2>FixedArray Distribution</h2>
        <div style={subComponentStyle}>
          <PieChart chartData={this.fixedArrayData("live")}
                    chartOptions={null}
                    chartStyle={chartStyle}
                    handleSelection={this.handleSelection} />
          <PieChart chartData={this.fixedArrayData("dead")}
                    chartOptions={null}
                    chartStyle={chartStyle}
                    handleSelection={this.handleSelection} />
        </div>
        <h2>FixedArray Overhead</h2>
        <div style={subComponentStyle}>
          <BarChart chartData={this.fixedArrayOverheadData("live")}
                    chartOptions={fixedArrayOverheadOptions}
                    chartStyle={chartStyle} />
          <BarChart chartData={this.fixedArrayOverheadData("dead")}
                    chartOptions={fixedArrayOverheadOptions}
                    chartStyle={chartStyle} />
        </div>
        <div style={{display: this.state.selectedSubType === null ?
                                  "none" : "inline"}} >
          <h2>
            Size Histogram:
            <tt>{this.subTypeName(this.state.selectedSubType)}</tt>
          </h2>
          <div style={subComponentStyle}>
            <BarChart chartData={this.fixedArraySubTypeData("live")}
                      chartOptions={subTypeOptions}
                      chartStyle={chartStyle} />
            <BarChart chartData={this.fixedArraySubTypeData("dead")}
                      chartOptions={subTypeOptions}
                      chartStyle={chartStyle} />
          </div>
          <h2>
            Overhead Size Histogram:
            <tt>{this.subTypeName(this.state.selectedSubType)}</tt>
          </h2>
          <div style={subComponentStyle}>
            <BarChart chartData={this.fixedArrayOverheadSubTypeData("live")}
                      chartOptions={subTypeOptions}
                      chartStyle={chartStyle} />
            <BarChart chartData={this.fixedArrayOverheadSubTypeData("dead")}
                      chartOptions={subTypeOptions}
                      chartStyle={chartStyle} />
          </div>
        </div>
      </div>
    );
  }
});

var CodeDetails = React.createClass({
  subTypeName: function(fullName) {
    if (fullName === null) return null;
    return fullName.slice("*CODE_".length);
  },

  ageName: function(fullName) {
    if (fullName === null) return null;
    return fullName.slice("*CODE_AGE_".length);
  },

  codeData: function(key) {
    if (this.props.data === null) return null;
    const data = rawDataTransform(this.props.data,
      key,
      ['Memory consumption [Bytes]'],
      name => name.startsWith("*CODE_") && !name.startsWith("*CODE_AGE_"),
      name => this.subTypeName(name),
      value => value === undefined ? 0 : [value.overall]);
    return {data: data, colors: []};
  },

  codeAgeData: function(key) {
    if (this.props.data === null) return null;
    const data = rawDataTransform(this.props.data,
      key,
      ['Memory consumption [Bytes]'],
      name => name.startsWith("*CODE_AGE_"),
      name => this.ageName(name),
      value => value === undefined ? 0 : [value.overall]);
    return {data: data, colors: []};
  },

  render: function() {
    const subComponentStyle = {
      height: "600px",
      width: "100%"
    };
    const chartStyle = {
      width: "50%",
      height: "600px",
      float: "left"
    };
    return (
      <div style={{display: this.props.show ? "inline" : "none"}} >
        <h2>Code Distribution</h2>
        <div style={subComponentStyle}>
          <PieChart chartData={this.codeData("live")}
                    chartOptions={null}
                    chartStyle={chartStyle} />
          <PieChart chartData={this.codeData("dead")}
                    chartOptions={null}
                    chartStyle={chartStyle} />
        </div>
        <h2>Code Age</h2>
        <div style={subComponentStyle}>
          <PieChart chartData={this.codeAgeData("live")}
                    chartOptions={null}
                    chartStyle={chartStyle} />
          <PieChart chartData={this.codeAgeData("dead")}
                    chartOptions={null}
                    chartStyle={chartStyle} />
        </div>
      </div>
    );
  }
});

module.exports = {
  CodeDetails: CodeDetails,
  FixedArrayDetails: FixedArrayDetails
};
