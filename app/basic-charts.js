import React from "react";

var AreaChart = React.createClass({
  getInitialState: function() {
    return { chart: null };
  },
  _clearChartIfNecessary: function() {
    if (this.state.chart != null){
      this.state.chart.clearChart();
    }
  },
  update: function(e) {
    this._clearChartIfNecessary();
    if (this.props.chartData == null) return;

    var chart = new google.visualization.AreaChart(this.refs.chart);
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

module.exports = {
    AreaChart: AreaChart,
}