require 'coffee-cache'
jasmine.getEnv().addEqualityTester(require('underscore-plus').isEqual)
{setEqual} = require '../src/set-helpers'

Set.prototype.isEqual = (other) ->
  if other instanceof Set
    setEqual(this, other)
  else
    undefined

Set.prototype.jasmineToString = ->
  result = "Set {"
  first = true
  @forEach (element) ->
    result += ", " unless first
    result += element.toString()
  first = false
  result + "}"

toEqualSet = (expectedItems, customMessage) ->
  pass = true
  expectedSet = new Set(expectedItems)
  customMessage ?= ""

  expectedSet.forEach (item) =>
    unless @actual.has(item)
      pass = false
      @message = -> "Expected set #{formatSet(@actual)} to have item #{item}. #{customMessage}"

  @actual.forEach (item) =>
    unless expectedSet.has(item)
      pass = false
      @message = -> "Expected set #{formatSet(@actual)} not to have item #{item}. #{customMessage}"

  pass

formatSet = (set) ->
  "(#{setToArray(set).join(' ')})"

setToArray = (set) ->
  items = []
  set.forEach (item) -> items.push(item)
  items.sort()

currentSpecFailed = ->
  jasmine
    .getEnv()
    .currentSpec
    .results()
    .getItems()
    .some (item) -> not item.passed()

module.exports = {toEqualSet, currentSpecFailed, formatSet}
