var util = require("./util")

/*
Callsite name management
*/
//var idstack = []
//function enterfn(id) { idstack.push(id) }
//function leavefn(id) { idstack.pop() }

var idstack = [""]
function enterfn(id) { idstack.push(idstack[idstack.length-1] + ":" + id) }
function leavefn(id) { idstack.pop() }

//var idstack= [0]
//var max_id
//function setmaxid(id) {max_id = id}
//function enterfn(id) { idstack.push(idstack[idstack.length-1] + id*Math.pow(max_id,idstack.length+2)) }
//function leavefn(id) { idstack.pop() }


/*
 Return the current structural name, as determined by the interpreter stack and loop counters of the trace
 */
function currentName(trace)
{
    //	var loopnum = this.loopcounters[idstack] || 0
    //	this.loopcounters[idstack] = loopnum + 1
    //	return JSON.stringify(idstack) + ":" + loopnum
    //    return idstack.slice().push(loopnum)
    //    return [idstack, loopnum]
    
    
    var id = idstack[idstack.length-1]
    var loopnum = trace.loopcounters[id] || 0
    trace.loopcounters[id] = loopnum + 1
	return id + ":" + loopnum
//    return id + max_id*loopnum //fixme: wrong if loopnum>max_id
}


/*
Enumeration sets new ERP calls to start of domain. Flag for this behavior:
*/
var initEnumerate = false
function startEnumerate() {initEnumerate = true}
function stopEnumerate() {initEnumerate = false}



/*
Variables generated by ERPs
*/
function RandomVariableRecord(name, erp, params, val, logprob, structural, conditioned)
{
	this.name = name
	this.erp = erp
	this.params = params
	this.val = val
	this.logprob = logprob
	this.active = true
	this.structural = structural
	this.conditioned = conditioned
}

RandomVariableRecord.prototype.copy = function copy()
{
	return new RandomVariableRecord(this.name, this.erp, this.params, this.val,
									this.logprob, this.structural, this.conditioned)
}


/*
Execution trace generated by a probabilistic program.
Tracks the random choices made and accumulates probabilities.
*/
function RandomExecutionTrace(computation, init)
{
	init = (init == undefined ? "rejection" : init)
	this.computation = computation
	this.vars = {}
	this.varlist = []
	this.currVarIndex = 0
	this.logprob = 0.0
	this.newlogprob = 0.0
	this.oldlogprob = 0.0
	this.rootframe = null
	this.loopcounters = {}
	this.conditionsSatisfied = false
	this.returnValue = null

    var nextstate = function(trace) {
        var names = trace.freeVarNames()
        var newval = null
        while (newval == null) {
            // if we are out of names it means we're done enumerating with no satisfying execution, return null.
            if (names.length == 0) {return null}
            
            //otherwise get next var:
            var varname = names.pop()
            var v = trace.getRecord(varname)
            
            //if the domain is enumerable, go to next value:
            if (typeof v.erp.nextVal === 'function') {
                var newval = v.erp.nextVal(v.val, v.params)
                if (newval == null) {
                    v.val = v.erp.nextVal(null, v.params) //get first in domain
                } else {
                    v.val = newval
                }
                v.logprob = v.erp.logprob(v.val, v.params)
            }
        }
        return varname
    }
    
	if (init == "rejection") {
		while (!this.conditionsSatisfied)
		{
			this.vars = {}
			this.traceUpdate()
		}
	} else if (init=="enumerate") {
        startEnumerate()
        this.traceUpdate()
        while (!this.conditionsSatisfied) {
            var r = nextstate(this)
            if (r == null) {this.vars = {}} //if we didn't find a satsfying state, reset.
            this.traceUpdate()
        }
        stopEnumerate()
    } else if (init=="lessdumb") {
        stopEnumerate() //FIXME: why do i need this? where is enumerateInit getting truned on??
        this.traceUpdate()
        var i=1, esteps=1
        while (!this.conditionsSatisfied) {
            if(i%esteps == 0) {
                //reset and initialize randomly:
                this.vars = {}
                this.traceUpdate()
                //do more enumeration after every restart:
                esteps += 10
            } else {
                try { //Geometric can blow up, because "000..." is the infinite execution. catch max callstack error and default to rejection.
                    startEnumerate()
                    var r = nextstate(this)
                    if (r == null) {this.vars = {}} //if we didn't find a satsfying state, reset.
                    this.traceUpdate()
                    stopEnumerate()}
                catch(err) {
                    //on error default to rejection...
                    console.log("caught error: " + err + ".")
                    stopEnumerate()
                    this.vars = {}
                    this.traceUpdate()
                }
            }
            i += 1
        }
    }
}

RandomExecutionTrace.prototype.deepcopy = function deepcopy()
{
	var newdb = new RandomExecutionTrace(this.computation, false)
	newdb.logprob = this.logprob
	newdb.oldlogprob = this.oldlogprob
	newdb.newlogprob = this.newlogprob
	newdb.conditionsSatisfied = this.conditionsSatisfied
	newdb.returnValue = this.returnValue

	for (var i = 0; i < this.varlist.length; i++)
	{
		var newvar = this.varlist[i].copy()
		newdb.varlist.push(newvar)
		newdb.vars[newvar.name] = newvar
	}

	return newdb
}

RandomExecutionTrace.prototype.freeVarNames = function freeVarNames(structural, nonstructural)
{
	structural = (structural == undefined ? true : structural)
	nonstructural = (nonstructural == undefined ? true : nonstructural)
	var names = []
	for (var name in this.vars)
	{
		var rec = this.vars[name]
		if (!rec.conditioned &&
			((structural && rec.structural) || (nonstructural && !rec.structural)))
			names.push(name)
	}
	return names
}

/*
Names of variables that this trace has that the other does not
*/
RandomExecutionTrace.prototype.varDiff = function varDiff(other)
{
	var arr = []
	for (var name in this.vars)
	{
		if (!other.vars[name])
			arr.push(name)
	}
	return arr
}

/*
Difference in log probability between this trace and the other
due to variables that this one has that the other does not
*/
RandomExecutionTrace.prototype.lpDiff = function lpDiff(other)
{
	return this.varDiff(other)
		.map(function(name) {return this.vars[name].logprob}.bind(this))
		.reduce(function(a,b) {return a+b}, 0)
}

/*
The singleton trace object
*/
var trace = null

/*
Run computation and update this trace accordingly
*/
RandomExecutionTrace.prototype.traceUpdate = function traceUpdate(structureIsFixed)
{
	var origtrace = trace
	trace = this

	this.logprob = 0.0
	this.newlogprob = 0.0
	this.loopcounters = {}
	this.conditionsSatisfied = true
	this.currVarIndex = 0

	// If updating this trace can change the variable structure, then we
	// clear out the flat list of variables beforehand
	if (!structureIsFixed)
		this.varlist.length = 0

	// Mark all variables as inactive; only those reached
	// by the computation will become active
	for (var name in this.vars)
		this.vars[name].active = false

	// Run the computation, creating/looking up random variables
	this.returnValue = this.computation()

	// Clean up
	this.rootframe = null
	this.loopcounters = {}

	// Clear out any random values that are no longer reachable
	var newvars = {}
	this.oldlogprob = 0.0
	for (var name in this.vars)
	{
		var rec = this.vars[name]
		if (!rec.active)
			this.oldlogprob += rec.logprob
		else
			newvars[name] = rec
	}
	this.vars = newvars

	// Reset the original singleton trace
	trace = origtrace
}

/*
Propose a random change to a random variable 'varname'
Returns a new sample trace from the computation and the
forward and reverse probabilities of this proposal
*/
RandomExecutionTrace.prototype.proposeChange = function proposeChange(varname, structureIsFixed)
{
	var nextTrace = this.deepcopy()
	var v = nextTrace.getRecord(varname)
	var propval = v.erp.proposal(v.val, v.params)
	var fwdPropLP = v.erp.logProposalProb(v.val, propval, v.params)
	var rvsPropLP = v.erp.logProposalProb(propval, v.val, v.params)
	v.val = propval
	v.logprob = v.erp.logprob(v.val, v.params)
	nextTrace.traceUpdate(structureIsFixed)
	fwdPropLP += nextTrace.newlogprob
	rvsPropLP += nextTrace.oldlogprob
	return [nextTrace, fwdPropLP, rvsPropLP]
}

///*
//Return the current structural name, as determined by the interpreter stack
//*/
//RandomExecutionTrace.prototype.currentName = function currentName()
//{
////	var loopnum = this.loopcounters[idstack] || 0
////	this.loopcounters[idstack] = loopnum + 1
////	return JSON.stringify(idstack) + ":" + loopnum
////    return idstack.slice().push(loopnum)
////    return [idstack, loopnum]
//    
//    
//    var id = idstack[idstack.length-1]
//    var loopnum = this.loopcounters[id] || 0
//    this.loopcounters[id] = loopnum + 1
//	return id + ":" + loopnum
//}

/*
Looks up the value of a random variable.
Creates the variable if it does not already exist
*/
RandomExecutionTrace.prototype.lookup = function lookup(erp, params, isStructural, conditionedValue)
{
    var record = null
    var name = null
    
    // Try to find the variable (first check the flat list, then do
    // slower structural lookup)
    var varIsInFlatList = this.currVarIndex < this.varlist.length
    if (varIsInFlatList) {
        record = this.varlist[this.currVarIndex]
    } else {
        name = currentName(this)
        record = this.vars[name]
        if (!record || record.erp != erp || record.structural != isStructural) {record = null}
    }
    
	// If we didn't find the variable, create a new one
	if (!record)
	{
        if (initEnumerate && typeof erp.nextVal === 'function') { // If we are doing ennumeration init new vars to first val in domain:
            var val = erp.nextVal(null, params)
        } else {
            var val = conditionedValue || erp.sample_impl(params)
        }
		var ll = erp.logprob(val, params)
		this.newlogprob += ll
		record = new RandomVariableRecord(name, erp, params, val, ll, isStructural, conditionedValue !== undefined)
		this.vars[name] = record
	}
	// Otherwise, reuse the variable we found, but check if its parameters/conditioning
	// status have changed
	else {
		record.conditioned = (conditionedValue != undefined)
		var hasChanges = false
		if (!util.arrayEquals(record.params, params))
		{
			record.params = params
			hasChanges = true
		}
		if (conditionedValue && conditionedValue != record.val)
		{
			record.val = conditionedValue
			record.conditioned = true
			hasChanges = true
		}
		if (hasChanges) {record.logprob = erp.logprob(record.val, record.params)}
    }
    
	// Finish up and return
	if (!varIsInFlatList){ this.varlist.push(record)}
    
    this.currVarIndex++
    this.logprob += record.logprob
    record.active = true
    return record.val
}

// Simply retrieve the variable record associated with 'name'
RandomExecutionTrace.prototype.getRecord = function getRecord(name)
{
	return this.vars[name]
}

// Add a new factor into the log-likelihood of this trace
RandomExecutionTrace.prototype.addFactor = function addFactor(num)
{
	this.logprob += num
}

// Condition the trace on the value of a boolean expression
RandomExecutionTrace.prototype.conditionOn = function conditionOn(boolexpr)
{
	this.conditionsSatisfied &= boolexpr
}



// Exported functions for interacting with the global trace

function lookupVariableValue(erp, params, isStructural, conditionedValue)
{
	if (!trace)
	{
		return conditionedValue || erp.sample_impl(params)
	}
	else
	{
		return trace.lookup(erp, params, isStructural, conditionedValue)
	}
}

function newTrace(computation, init)
{
	return new RandomExecutionTrace(computation, init)
}

function factor(num)
{
	if (trace)
		trace.addFactor(num)
}

function condition(boolexpr)
{
	if (trace)
		trace.conditionOn(boolexpr)
}


module.exports =
{
    startEnumerate: startEnumerate,
    stopEnumerate: stopEnumerate,
	enterfn: enterfn,
	leavefn: leavefn,
//    setmaxid: setmaxid,
	lookupVariableValue: lookupVariableValue,
	newTrace: newTrace,
	factor: factor,
	condition: condition
}