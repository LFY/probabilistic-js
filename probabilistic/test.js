var util = require("./util")
util.openModule(util)
var pr = require("./init")
util.openModule(pr)

var samples = 150
var lag = 20
var runs = 5
var errorTolerance = 0.07

function test(name, estimates, trueExpectation, tolerance)
{
	tolerance = (tolerance === undefined ? errorTolerance : tolerance)
	process.stdout.write("test: " + name + "...")
	var errors = estimates.map(function(est) { return Math.abs(est - trueExpectation) })
	var meanAbsError = mean(errors)
	if (meanAbsError > tolerance)
		console.log("failed! True mean: " + trueExpectation + " | Test mean: " + mean(estimates))
	else
		console.log("passed.")
}

function mhtest(name, computation, trueExpectation, tolerance)
{
	tolerance = (tolerance === undefined ? errorTolerance : tolerance)
	test(name, repeat(runs, function() { return expectation(computation, traceMH, samples, lag) }), trueExpectation, tolerance)
}

// function larjtest...

function eqtest(name, estvalues, truevalues, tolerance)
{
	tolerance = (tolerance === undefined ? errorTolerance : tolerance)
	process.stdout.write("test: " + name + "...")
	if (estvalues.length !== truevalues.length) throw new Error("lengths must be equal!")
	for (var i = 0; i < estvalues.length; i++)
	{
		var estv = estvalues[i]
		var truev = truevalues[i]
		if (Math.abs(estv - truev) > tolerance)
		{
			console.log("failed! True value: " + truev + " | Test value: " + estv)
			return
		}
	}
	console.log("passed.")
}

///////////////////////////////////////////////////////////////////////////////

var d1 = new Date()

console.log("starting tests...")

/*
ERP Tests
*/

test(
	"flip sample",
	repeat(runs, function() { return mean(repeat(samples, function() { return flip(0.7) }))}),
	0.7)

mhtest(
	"flip query",
	prob(function() { return flip(0.7) }),
	0.7)

test(
	"uniform sample",
	repeat(runs, function() { return mean(repeat(samples, function() { return uniform(0.1, 0.4) }))}),
	0.5*(.1+.4))

mhtest(
	"uniform query",
	prob(function() { return uniform(0.1, 0.4) }),
	0.5*(.1+.4))

test(
	"multinomial sample",
	repeat(runs, function() { return mean(repeat(samples, function() { return multinomialDraw([.2, .3, .4], [.2, .6, .2]) }))}),
	0.2*.2 + 0.6*.3 + 0.2*.4)

mhtest(
	"multinomial query",
	prob(function() { return multinomialDraw([.2, .3, .4], [.2, .6, .2]) }),
	0.2*.2 + 0.6*.3 + 0.2*.4)

eqtest(
	"multinomial lp",
	[
		multinomial_logprob(0, [.2, .6, .2]),
		multinomial_logprob(1, [.2, .6, .2]),
		multinomial_logprob(2, [.2, .6, .2])
	],
	[Math.log(0.2), Math.log(0.6), Math.log(0.2)])

test(
	"gaussian sample",
	repeat(runs, function() { return mean(repeat(samples, function() { return gaussian(0.1, 0.5) }))}),
	0.1)

mhtest(
	"gaussian query",
	prob(function() { return gaussian(0.1, 0.5) }),
	0.1)

eqtest(
	"gaussian lp",
	[
		gaussian_logprob(0, 0.1, 0.5),
		gaussian_logprob(0.25, 0.1, 0.5),
		gaussian_logprob(0.6, 0.1, 0.5)
	],
	[-0.2457913526447274, -0.27079135264472737, -0.7257913526447274])

test(
	"gamma sample",
	repeat(runs, function() { return mean(repeat(samples, function() { return gamma(2, 2)/10 }))}),
	0.4)

mhtest(
	"gamma query",
	prob(function() { return gamma(2, 2)/10 }),
	0.4)

eqtest(
	"gamma lp",
	[
		gamma_logprob(1, 2, 2),
		gamma_logprob(4, 2, 2),
		gamma_logprob(8, 2, 2)
	],
	[-1.8862944092546166, -2.000000048134726, -3.306852867574781])

test(
	"beta sample",
	repeat(runs, function() { return mean(repeat(samples, function() { return beta(2, 5) }))}),
	2.0/(2+5))

mhtest(
	"beta query",
	prob(function() { return beta(2, 5) }),
	2.0/(2+5))

eqtest(
	"beta lp",
	[
		beta_logprob(.1, 2, 5),
		beta_logprob(.2, 2, 5),
		beta_logprob(.6, 2, 5)
	],
	[0.677170196389683, 0.899185234324094, -0.7747911992475776])

test(
	"binomial sample",
	repeat(runs, function() { return mean(repeat(samples, function() { return binomial(.5, 40)/40 }))}),
	0.5)

mhtest(
	"binomial query",
	prob(function() { return binomial(.5, 40)/40 }),
	0.5)

eqtest(
	"binomial lp",
	[
		binomial_logprob(15, .5, 40),
		binomial_logprob(20, .5, 40),
		binomial_logprob(30, .5, 40)
	],
	[-3.3234338674089985, -2.0722579911387817, -7.2840211276953575])

test(
	"poisson sample",
	repeat(runs, function() { return mean(repeat(samples, function() { return poisson(4)/10 }))}),
	0.4)

mhtest(
	"poisson query",
	prob(function() { return poisson(4)/10 }),
	0.4)

eqtest(
	"poisson lp",
	[
		poisson_logprob(2, 4),
		poisson_logprob(5, 4),
		poisson_logprob(7, 4)
	],
	[-1.9205584583201643, -1.8560199371825927, -2.821100833226181])


console.log("tests done!")

var d2 = new Date()
console.log("time: " + (d2.getTime() - d1.getTime()))