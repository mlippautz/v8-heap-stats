import React from "react";

var AreaChart = React.createClass({
  getInitialState: function() {
    return {chart: null};
  },
  _clearChartIfNecessary: function() {
    if (this.state.chart !== null) {
      this.state.chart.clearChart();
    }
  },
  update: function(e) {
    this._clearChartIfNecessary();
    if (this.props.chartData === null) return;

    const data = google.visualization.arrayToDataTable(this.props.chartData);
    const chart = new google.visualization.AreaChart(this.refs.chart);
    chart.draw(data, this.props.chartOptions);
    this.state.chart = chart;

    var selectHandler = function() {
      var selectedItem = chart.getSelection()[0];
      if (selectedItem && ('handleSelection' in this.props)) {
        this.props.handleSelection(data.getValue(selectedItem.row, 0),
                                   data.getColumnLabel(selectedItem.column));
      }
    }.bind(this);
    google.visualization.events.addListener(chart, 'select', selectHandler);
  },
  componentDidUpdate: function() {
    this.update();
  },
  render: function() {
    return (
      <div>
        <div ref="chart" style={this.props.chartStyle} ></div>
      </div>
    );
  }
});

var LineChart = React.createClass({
  getInitialState: function() {
    return {chart: null};
  },
  _clearChartIfNecessary: function() {
    if (this.state.chart !== null) {
      this.state.chart.clearChart();
    }
  },
  update: function(e) {
    this._clearChartIfNecessary();
    if (this.props.chartData === null) return;

    const chart = new google.visualization.LineChart(this.refs.chart);
    chart.draw(google.visualization.arrayToDataTable(this.props.chartData),
               this.props.chartOptions);
    this.state.chart = chart;
  },
  componentDidUpdate: function() {
    this.update();
  },
  render: function() {
    return (
      <div>
        <div ref="chart" style={this.props.chartStyle} ></div>
      </div>
    );
  }
});

var PieChart = React.createClass({
  getInitialState: function() {
    return {chart: null};
  },
  _clearChartIfNecessary: function() {
    if (this.state.chart !== null) {
      this.state.chart.clearChart();
    }
  },
  update: function(e) {
    this._clearChartIfNecessary();
    if (this.props.chartData === null) return;

    let colors = [];
    for (let i = 0; i < this.props.chartData.colors.length; i++) {
      colors.push({color: this.props.chartData.colors[i]});
    }

    let options = Object.assign({slices: colors}, this.props.chartOptions);
    var data = google.visualization.arrayToDataTable(this.props.chartData.data);
    let chart = new google.visualization.PieChart(this.refs.chart);
    chart.draw(data, options);
    let selectHandler = function() {
      let selectedItem = chart.getSelection()[0];
      if (selectedItem && ('handleSelection' in this.props)) {
        this.props.handleSelection(data.getValue(selectedItem.row, 0));
      }
    }.bind(this);
    google.visualization.events.addListener(chart, 'select', selectHandler);
    this.state.chart = chart;
  },
  componentDidUpdate: function() {
    this.update();
  },
  render: function() {
    return (
      <div>
        <div ref="chart" style={this.props.chartStyle} ></div>
      </div>
    );
  }
});

var BarChart = React.createClass({
  getInitialState: function() {
    return {chart: null};
  },
  _clearChartIfNecessary: function() {
    if (this.state.chart !== null) {
      this.state.chart.clearChart();
    }
  },
  update: function(e) {
    this._clearChartIfNecessary();
    if (this.props.chartData === null) return;

    var chart = new google.charts.Bar(this.refs.chart);
    chart.draw(google.visualization.arrayToDataTable(this.props.chartData),
               google.charts.Bar.convertOptions(this.props.chartOptions));
    this.state.chart = chart;
  },
  componentDidUpdate: function() {
    this.update();
  },
  render: function() {
    return (
      <div>
        <div ref="chart" style={this.props.chartStyle} ></div>
      </div>
    );
  }
});

module.exports = {
  AreaChart: AreaChart,
  PieChart: PieChart,
  BarChart: BarChart,
  LineChart: LineChart
};
