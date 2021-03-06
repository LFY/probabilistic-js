var util = require("./util");

function disp_addrval_string(addrs, vals) {
	console.log("Addr-vals:");
	console.log("\t" + JSON.stringify(addrs));
	console.log("\t" + JSON.stringify(vals));
}

function get_seq_addr_vals(trace) {

	var res_addrs = [];
	var res_vals = [];

	for (addr in trace.vars) {
		res_addrs.push(addr);
		res_vals.push(trace.vars[addr].val);
	}

	var res = [res_addrs, res_vals];
	return res;
}

WorldGraph.prototype.update_transitions = function update_transitions(addr_vals) {
	this.transitions[this.time] = util.deep_copy(addr_vals);
	this.time++;
}

// Function to incorporate one trace. Worldgraph transitions are then based
// off of it.

WorldGraph.prototype.incorp_trace = function incorp_trace(input_trace) {

	var addr_vals = get_seq_addr_vals(input_trace);
	this.update_transitions(addr_vals);
}

WorldGraph.prototype.deepcopy = function deepcopy() {
	var copy_traces = [];
	for (var i = 0; i < this.traces.length; i++) {
		copy_traces.push(this.traces[i].deepcopy());
	}
}

function WorldGraph(initial_trace) {
	if (undefined == initial_trace) {
		this.traces = []; 
	} else {
		this.traces = [initial_trace.deepcopy()];
	}

	this.transitions = {};
	this.time = 0;

	for (i in this.traces) {
		this.incorp_trace(this.traces[i]);
	}
}

function new_worldgraph(first_trace) {
	return new WorldGraph(first_trace);
}

module.exports = {
	new_worldgraph : new_worldgraph
};