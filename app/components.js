import React from "react";
import {AreaChart, BarChart, LineChart, PieChart} from "./basic-charts";  // eslint-disable-line no-unused-vars
import {Colors, InstanceTypeGroups, InstanceSubTypeNames} from "./utils";  // eslint-disable-line no-unused-vars

const KB = 1024;

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

function typeName(fullName) {
  if (fullName === null) return null;
  if (fullName.endsWith("_SUB_TYPE"))
    fullName = fullName.slice(0, -("_SUB_TYPE".length));
  if (fullName.endsWith("_TYPE"))
    fullName = fullName.slice(0, -("_TYPE".length));
  if (fullName.startsWith("*FIXED_ARRAY_"))
    fullName = fullName.slice("*FIXED_ARRAY_".length);
  return fullName;
}

function isSimpleInstanceType(name) {
  for (let key of Object.keys(InstanceTypeGroups)) {
    if (key === name) return false;
  }
  return true;
}

var FixedArrayDetails = React.createClass({  // eslint-disable-line no-unused-vars
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
      name => typeName(name),
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
    return (
      <div style={{display: this.props.show ? "inline" : "none"}} >
        <h2>FixedArray Overhead</h2>
        <div style={subComponentStyle}>
          <BarChart chartData={this.fixedArrayOverheadData("live")}
                    chartOptions={fixedArrayOverheadOptions}
                    chartStyle={chartStyle} />
          <BarChart chartData={this.fixedArrayOverheadData("dead")}
                    chartOptions={fixedArrayOverheadOptions}
                    chartStyle={chartStyle} />
        </div>
      </div>
    );
  }
});

var CodeDetails = React.createClass({  // eslint-disable-line no-unused-vars
  subTypeName: function(fullName) {
    if (fullName === null) return null;
    return fullName.slice("*CODE_".length);
  },

  ageName: function(fullName) {
    if (fullName === null) return null;
    return fullName.slice("*CODE_AGE_".length);
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

const InstanceTypeDistribution = React.createClass({  // eslint-disable-line no-unused-vars
  getInstanceTypeData(key) {
    if (this.props.instanceTypes === null) return null;
    const colors = [];
    const data = rawDataTransform(this.props.data,
      key,
      ['Memory consumption [Bytes]'],
      name => InstanceTypeGroups[this.props.instanceType].includes(name),
      name => {
        colors.push(Colors.getColor(name));
        return InstanceSubTypeNames[this.props.instanceType].keyToName(name);
      },
      value => value === undefined ? 0 : [value.overall]);
    return {data: data, colors: colors};
  },

  handleSelection(item) {
    item = InstanceSubTypeNames[this.props.instanceType].nameToKey(item);
    console.log("Selected sub type: " + item);
    this.props.handleSubTypeSelection(item);
  },

  render() {
    const subComponentStyle = {
      height: "450px",
      width: "100%"
    };
    const chartStyle = {
      width: "50%",
      height: "450px",
      float: "left"
    };
    return (
      <div>
        <h2>Distribution: <tt>{this.props.instanceType}</tt></h2>
        <div style={subComponentStyle}>
          <PieChart chartData={this.getInstanceTypeData("live")}
                    chartOptions={null}
                    chartStyle={chartStyle}
                    handleSelection={this.handleSelection} />
          <PieChart chartData={this.getInstanceTypeData("dead")}
                    chartOptions={null}
                    chartStyle={chartStyle}
                    handleSelection={this.handleSelection} />
        </div>
      </div>
    );
  }
});

const InstanceTypeHistogram = React.createClass({  // eslint-disable-line no-unused-vars
  overAllocatedHistogram() {
    if (this.props.overAllocated !== undefined &&
        this.props.overAllocated === true) return true;
    return false;
  },

  selectedInstanceTypeData: function(key) {
    const emptyResponse = {
      overall: 0,
      count: 0
    };

    const instanceType = this.props.instanceType;
    const gcData = this.props.data;
    if (gcData === null || instanceType === null) return emptyResponse;
    if (!(instanceType in gcData[key].instanceTypeData)) return emptyResponse;
    if (this.overAllocatedHistogram()) {
      return {
        overall: gcData[key].instanceTypeData[instanceType].overAllocated,
        count: 0  // TODO: Data is missing.
      };
    }
    return gcData[key].instanceTypeData[instanceType];
  },

  instanceTypeSizeData: function(instanceType, key) {
    if (this.props.instanceType === null ||
        !isSimpleInstanceType(this.props.instanceType) ||
        this.props.data === null)
      return null;

    const histogramPropery = this.props.overAllocated !== undefined &&
                             this.props.overAllocated === true ?
      "overAllocatedHistogram" : "overallHistogram";

    const selectedGCData = this.props.data;
    const bucketLabels = selectedGCData[key].bucketSizes;
    const bucketSizes = selectedGCData[key]
      .instanceTypeData[instanceType][histogramPropery];
    const labels = ['Bucket', 'Count'];
    const data = [];
    for (let i = 0; i < bucketSizes.length; i++) {
      data.push(['<' + bucketLabels[i], bucketSizes[i]]);
    }
    return [labels, ...data];
  },

  render() {
    const instanceTypeSizeOptions = {
      title: 'Size Histogram',
      bars: 'vertical',
      legend: {position: 'none'}
    };
    const instanceTypeSizeHeight = "300px";
    return (
<div>
  <h2>{this.overAllocatedHistogram() ? "Overhead" : "Size"} Details: <tt>{typeName(this.props.instanceType)}</tt></h2>
  <div style={null}>
    <div style={{width: '50%', float: 'left'}}>
      <h3 style={{textAlign: 'center'}}>Live</h3>
      <ul>
        <li>Overall memory consumption: {this.selectedInstanceTypeData("live").overall / KB} KB</li>
        {
          this.overAllocatedHistogram() ? "" :
            (<li>Overall count: {this.selectedInstanceTypeData("live").count}</li>)
        }
      </ul>
      <BarChart chartData={this.instanceTypeSizeData(this.props.instanceType, "live")}
                chartOptions={instanceTypeSizeOptions}
                chartStyle={{height: instanceTypeSizeHeight, margin: '30px'}} />
    </div>
    <div style={{width: '50%', float: 'left'}}>
      <h3 style={{textAlign: 'center'}}>Dead</h3>
      <ul>
        <li>Overall memory consumption: {this.selectedInstanceTypeData("dead").overall / KB} KB</li>
        <li>Overall count: {this.selectedInstanceTypeData("dead").count}</li>
      </ul>
      <BarChart chartData={this.instanceTypeSizeData(this.props.instanceType, "dead")}
                chartOptions={instanceTypeSizeOptions}
                chartStyle={{height: instanceTypeSizeHeight, margin: '30px'}} />
    </div>
  </div>
</div>
);
  }
});

var InstanceTypeDetails = React.createClass({
  getInitialState() {
    return {
      selectedSubType: null
    };
  },

  handleSubTypeSelection(item) {
    this.setState({
      selectedSubType: item
    });
  },

  render: function() {
    let details = (
      <div></div>
    );
    if (this.props.instanceType !== null) {
      if (isSimpleInstanceType(this.props.instanceType)) {
        details = (
          <InstanceTypeHistogram data={this.props.data}
                                 instanceType={this.props.instanceType} />
        );
      } else {
        details = (<div>
          <InstanceTypeDistribution data={this.props.data}
                                    instanceType={this.props.instanceType}
                                    handleSubTypeSelection={this.handleSubTypeSelection} />
          {
            this.state.selectedSubType === null ? "" :
              (<InstanceTypeHistogram data={this.props.data}
                                      instanceType={this.state.selectedSubType} />)
          }
          {
            this.state.selectedSubType !== null && this.props.instanceType === "FIXED_ARRAY_TYPE" ?
              (<InstanceTypeHistogram data={this.props.data}
                                      instanceType={this.state.selectedSubType}
                                      overAllocated={true} />) : ""
          }
          <FixedArrayDetails show={this.props.instanceType === "FIXED_ARRAY_TYPE"}
                            data={this.props.data} />
          <CodeDetails show={this.props.instanceType === "CODE_TYPE"}
                       data={this.props.data} />
        </div>);
      }
    }

    return (
      <div>
        {details}
      </div>
    );
  }
});

module.exports = {
  InstanceTypeDetails: InstanceTypeDetails
};
