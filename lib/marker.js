(function() {
  var Delegator, Emitter, EmitterMixin, Grim, Marker, OptionKeys, Point, Range, extend, isEqual, omit, pick, size, _ref,
    __slice = [].slice;

  _ref = require('underscore-plus'), extend = _ref.extend, isEqual = _ref.isEqual, omit = _ref.omit, pick = _ref.pick, size = _ref.size;

  Emitter = require('event-kit').Emitter;

  Grim = require('grim');

  Delegator = require('delegato');

  Point = require('./point');

  Range = require('./range');

  OptionKeys = new Set(['reversed', 'tailed', 'invalidate', 'persistent', 'maintainHistory']);

  module.exports = Marker = (function() {
    Delegator.includeInto(Marker);

    Marker.extractParams = function(inputParams) {
      var key, outputParams, _i, _len, _ref1;
      outputParams = {};
      if (inputParams != null) {
        if (Grim.includeDeprecatedAPIs) {
          this.handleDeprecatedParams(inputParams);
        }
        _ref1 = Object.keys(inputParams);
        for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
          key = _ref1[_i];
          if (OptionKeys.has(key)) {
            outputParams[key] = inputParams[key];
          } else {
            if (outputParams.properties == null) {
              outputParams.properties = {};
            }
            outputParams.properties[key] = inputParams[key];
          }
        }
      }
      return outputParams;
    };

    Marker.delegatesMethods('containsPoint', 'containsRange', 'intersectsRow', {
      toMethod: 'getRange'
    });

    function Marker(id, store, range, params) {
      this.id = id;
      this.store = store;
      this.tailed = params.tailed, this.reversed = params.reversed, this.valid = params.valid, this.invalidate = params.invalidate, this.persistent = params.persistent, this.properties = params.properties, this.maintainHistory = params.maintainHistory;
      this.emitter = new Emitter;
      if (this.tailed == null) {
        this.tailed = true;
      }
      if (this.reversed == null) {
        this.reversed = false;
      }
      if (this.valid == null) {
        this.valid = true;
      }
      if (this.invalidate == null) {
        this.invalidate = 'overlap';
      }
      if (this.persistent == null) {
        this.persistent = true;
      }
      if (this.maintainHistory == null) {
        this.maintainHistory = false;
      }
      if (this.properties == null) {
        this.properties = {};
      }
      this.hasChangeObservers = false;
      this.rangeWhenDestroyed = null;
      Object.freeze(this.properties);
      this.store.setMarkerHasTail(this.id, this.tailed);
    }


    /*
    Section: Event Subscription
     */

    Marker.prototype.onDidDestroy = function(callback) {
      return this.emitter.on('did-destroy', callback);
    };

    Marker.prototype.onDidChange = function(callback) {
      if (!this.hasChangeObservers) {
        this.previousEventState = this.getSnapshot(this.getRange());
        this.hasChangeObservers = true;
      }
      return this.emitter.on('did-change', callback);
    };

    Marker.prototype.getRange = function() {
      var _ref1;
      return (_ref1 = this.rangeWhenDestroyed) != null ? _ref1 : this.store.getMarkerRange(this.id);
    };

    Marker.prototype.setRange = function(range, properties) {
      var params;
      params = this.extractParams(properties);
      params.tailed = true;
      params.range = Range.fromObject(range, true);
      return this.update(this.getRange(), params);
    };

    Marker.prototype.getHeadPosition = function() {
      if (this.reversed) {
        return this.getStartPosition();
      } else {
        return this.getEndPosition();
      }
    };

    Marker.prototype.setHeadPosition = function(position, properties) {
      var oldRange, params;
      position = Point.fromObject(position);
      params = this.extractParams(properties);
      oldRange = this.getRange();
      if (this.hasTail()) {
        if (this.isReversed()) {
          if (position.isLessThan(oldRange.end)) {
            params.range = new Range(position, oldRange.end);
          } else {
            params.reversed = false;
            params.range = new Range(oldRange.end, position);
          }
        } else {
          if (position.isLessThan(oldRange.start)) {
            params.reversed = true;
            params.range = new Range(position, oldRange.start);
          } else {
            params.range = new Range(oldRange.start, position);
          }
        }
      } else {
        params.range = new Range(position, position);
      }
      return this.update(oldRange, params);
    };

    Marker.prototype.getTailPosition = function() {
      if (this.reversed) {
        return this.getEndPosition();
      } else {
        return this.getStartPosition();
      }
    };

    Marker.prototype.setTailPosition = function(position, properties) {
      var oldRange, params;
      position = Point.fromObject(position);
      params = this.extractParams(properties);
      params.tailed = true;
      oldRange = this.getRange();
      if (this.reversed) {
        if (position.isLessThan(oldRange.start)) {
          params.reversed = false;
          params.range = new Range(position, oldRange.start);
        } else {
          params.range = new Range(oldRange.start, position);
        }
      } else {
        if (position.isLessThan(oldRange.end)) {
          params.range = new Range(position, oldRange.end);
        } else {
          params.reversed = true;
          params.range = new Range(oldRange.end, position);
        }
      }
      return this.update(oldRange, params);
    };

    Marker.prototype.getStartPosition = function() {
      var _ref1, _ref2;
      return (_ref1 = (_ref2 = this.rangeWhenDestroyed) != null ? _ref2.start : void 0) != null ? _ref1 : this.store.getMarkerStartPosition(this.id);
    };

    Marker.prototype.getEndPosition = function() {
      var _ref1, _ref2;
      return (_ref1 = (_ref2 = this.rangeWhenDestroyed) != null ? _ref2.end : void 0) != null ? _ref1 : this.store.getMarkerEndPosition(this.id);
    };

    Marker.prototype.clearTail = function(properties) {
      var headPosition, params;
      params = this.extractParams(properties);
      params.tailed = false;
      headPosition = this.getHeadPosition();
      params.range = new Range(headPosition, headPosition);
      return this.update(this.getRange(), params);
    };

    Marker.prototype.plantTail = function(properties) {
      var params;
      params = this.extractParams(properties);
      if (!this.hasTail()) {
        params.tailed = true;
        params.range = new Range(this.getHeadPosition(), this.getHeadPosition());
      }
      return this.update(this.getRange(), params);
    };

    Marker.prototype.isReversed = function() {
      return this.tailed && this.reversed;
    };

    Marker.prototype.hasTail = function() {
      return this.tailed;
    };

    Marker.prototype.isValid = function() {
      return !this.isDestroyed() && this.valid;
    };

    Marker.prototype.isDestroyed = function() {
      return this.rangeWhenDestroyed != null;
    };

    Marker.prototype.isEqual = function(other) {
      return this.invalidate === other.invalidate && this.tailed === other.tailed && this.persistent === other.persistent && this.maintainHistory === other.maintainHistory && this.reversed === other.reversed && isEqual(this.properties, other.properties) && this.getRange().isEqual(other.getRange());
    };

    Marker.prototype.getInvalidationStrategy = function() {
      return this.invalidate;
    };

    Marker.prototype.getProperties = function() {
      return this.properties;
    };

    Marker.prototype.setProperties = function(properties) {
      return this.update(this.getRange(), {
        properties: extend({}, this.properties, properties)
      });
    };

    Marker.prototype.copy = function(options) {
      var snapshot;
      if (options == null) {
        options = {};
      }
      snapshot = this.getSnapshot(null);
      options = Marker.extractParams(options);
      return this.store.createMarker(this.getRange(), extend({}, snapshot, options, {
        properties: extend({}, snapshot.properties, options.properties)
      }));
    };

    Marker.prototype.destroy = function() {
      this.rangeWhenDestroyed = this.getRange();
      this.store.destroyMarker(this.id);
      this.emitter.emit('did-destroy');
      if (Grim.includeDeprecatedAPIs) {
        return this.emit('destroyed');
      }
    };

    Marker.prototype.extractParams = function(params) {
      params = this.constructor.extractParams(params);
      if (params.properties != null) {
        params.properties = extend({}, this.properties, params.properties);
      }
      return params;
    };

    Marker.prototype.compare = function(other) {
      return this.getRange().compare(other.getRange());
    };

    Marker.prototype.matchesParams = function(params) {
      var key, _i, _len, _ref1;
      _ref1 = Object.keys(params);
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        key = _ref1[_i];
        if (!this.matchesParam(key, params[key])) {
          return false;
        }
      }
      return true;
    };

    Marker.prototype.matchesParam = function(key, value) {
      switch (key) {
        case 'startPosition':
          return this.getStartPosition().isEqual(value);
        case 'endPosition':
          return this.getEndPosition().isEqual(value);
        case 'containsPoint':
        case 'containsPosition':
          return this.containsPoint(value);
        case 'containsRange':
          return this.containsRange(value);
        case 'startRow':
          return this.getStartPosition().row === value;
        case 'endRow':
          return this.getEndPosition().row === value;
        case 'intersectsRow':
          return this.intersectsRow(value);
        case 'invalidate':
        case 'reversed':
        case 'tailed':
        case 'persistent':
        case 'maintainHistory':
          return isEqual(this[key], value);
        default:
          return isEqual(this.properties[key], value);
      }
    };

    Marker.prototype.update = function(oldRange, _arg, textChanged) {
      var properties, propertiesChanged, range, reversed, tailed, updated, valid;
      range = _arg.range, reversed = _arg.reversed, tailed = _arg.tailed, valid = _arg.valid, properties = _arg.properties;
      if (textChanged == null) {
        textChanged = false;
      }
      if (this.isDestroyed()) {
        return;
      }
      updated = propertiesChanged = false;
      if ((range != null) && !range.isEqual(oldRange)) {
        this.store.setMarkerRange(this.id, range);
        updated = true;
      }
      if ((reversed != null) && reversed !== this.reversed) {
        this.reversed = reversed;
        updated = true;
      }
      if ((tailed != null) && tailed !== this.tailed) {
        this.tailed = tailed;
        this.store.setMarkerHasTail(this.id, this.tailed);
        updated = true;
      }
      if ((valid != null) && valid !== this.valid) {
        this.valid = valid;
        updated = true;
      }
      if ((properties != null) && !isEqual(properties, this.properties)) {
        this.properties = Object.freeze(properties);
        propertiesChanged = true;
        updated = true;
      }
      this.emitChangeEvent(range != null ? range : oldRange, textChanged, propertiesChanged);
      if (updated && !textChanged) {
        this.store.markerUpdated();
      }
      return updated;
    };

    Marker.prototype.getSnapshot = function(range) {
      return Object.freeze({
        range: range,
        properties: this.properties,
        reversed: this.reversed,
        tailed: this.tailed,
        valid: this.valid,
        invalidate: this.invalidate,
        maintainHistory: this.maintainHistory
      });
    };

    Marker.prototype.toString = function() {
      return "[Marker " + this.id + ", " + (this.getRange()) + "]";
    };


    /*
    Section: Private
     */

    Marker.prototype.emitChangeEvent = function(currentRange, textChanged, propertiesChanged) {
      var newHeadPosition, newState, newTailPosition, oldHeadPosition, oldState, oldTailPosition;
      if (!this.hasChangeObservers) {
        return;
      }
      oldState = this.previousEventState;
      if (currentRange == null) {
        currentRange = this.getRange();
      }
      if (!(propertiesChanged || oldState.valid !== this.valid || oldState.tailed !== this.tailed || oldState.reversed !== this.reversed || oldState.range.compare(currentRange) !== 0)) {
        return false;
      }
      newState = this.previousEventState = this.getSnapshot(currentRange);
      if (oldState.reversed) {
        oldHeadPosition = oldState.range.start;
        oldTailPosition = oldState.range.end;
      } else {
        oldHeadPosition = oldState.range.end;
        oldTailPosition = oldState.range.start;
      }
      if (newState.reversed) {
        newHeadPosition = newState.range.start;
        newTailPosition = newState.range.end;
      } else {
        newHeadPosition = newState.range.end;
        newTailPosition = newState.range.start;
      }
      this.emitter.emit("did-change", {
        wasValid: oldState.valid,
        isValid: newState.valid,
        hadTail: oldState.tailed,
        hasTail: newState.tailed,
        oldProperties: oldState.properties,
        newProperties: newState.properties,
        oldHeadPosition: oldHeadPosition,
        newHeadPosition: newHeadPosition,
        oldTailPosition: oldTailPosition,
        newTailPosition: newTailPosition,
        textChanged: textChanged
      });
      return true;
    };

    return Marker;

  })();

  if (Grim.includeDeprecatedAPIs) {
    EmitterMixin = require('emissary').Emitter;
    EmitterMixin.includeInto(Marker);
    Marker.prototype.on = function(eventName) {
      switch (eventName) {
        case 'changed':
          Grim.deprecate("Use Marker::onDidChange instead");
          break;
        case 'destroyed':
          Grim.deprecate("Use Marker::onDidDestroy instead");
          break;
        default:
          Grim.deprecate("Marker::on is deprecated. Use event subscription methods instead.");
      }
      return EmitterMixin.prototype.on.apply(this, arguments);
    };
    Marker.prototype.matchesAttributes = function() {
      var args;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      Grim.deprecate("Use Marker::matchesParams instead.");
      return this.matchesParams.apply(this, args);
    };
    Marker.prototype.getAttributes = function() {
      Grim.deprecate("Use Marker::getProperties instead.");
      return this.getProperties();
    };
    Marker.prototype.setAttributes = function() {
      var args;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      Grim.deprecate("Use Marker::setProperties instead.");
      return this.setProperties.apply(this, args);
    };
    Marker.handleDeprecatedParams = function(params) {
      if (params.isReversed != null) {
        Grim.deprecate("The option `isReversed` is deprecated, use `reversed` instead");
        params.reversed = params.isReversed;
        delete params.isReversed;
      }
      if (params.hasTail != null) {
        Grim.deprecate("The option `hasTail` is deprecated, use `tailed` instead");
        params.tailed = params.hasTail;
        delete params.hasTail;
      }
      if (params.persist != null) {
        Grim.deprecate("The option `persist` is deprecated, use `persistent` instead");
        params.persistent = params.persist;
        delete params.persist;
      }
      if (params.invalidation) {
        Grim.deprecate("The option `invalidation` is deprecated, use `invalidate` instead");
        params.invalidate = params.invalidation;
        return delete params.invalidation;
      }
    };
  }

}).call(this);
