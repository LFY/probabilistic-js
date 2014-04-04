var util = require("./util")

function disp_addrval_string(addrs, vals) {
	var res = [];
	for(var i = 0; i < addrs.length; i++) {
		var cell = [];
		cell.push(addrs[i]);
		cell.push(vals[i]);
		res.push(cell);
	}
	return res;
}
