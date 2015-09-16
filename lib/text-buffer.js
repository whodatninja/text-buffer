(function() {
  var CompositeDisposable, Emitter, EmitterMixin, Grim, History, MarkerStore, MatchIterator, Patch, Point, Range, SearchCallbackArgument, Serializable, SpanSkipList, Subscriber, TextBuffer, TransactionAbortedError, diff, newlineRegex, spliceArray, _, _ref, _ref1,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  Grim = require('grim');

  Serializable = require('serializable');

  _ref = require('event-kit'), Emitter = _ref.Emitter, CompositeDisposable = _ref.CompositeDisposable;

  SpanSkipList = require('span-skip-list');

  diff = require('atom-diff');

  _ = require('underscore-plus');

  Point = require('./point');

  Range = require('./range');

  History = require('./history');

  MarkerStore = require('./marker-store');

  Patch = require('./patch');

  MatchIterator = require('./match-iterator');

  _ref1 = require('./helpers'), spliceArray = _ref1.spliceArray, newlineRegex = _ref1.newlineRegex;

  SearchCallbackArgument = (function() {
    Object.defineProperty(SearchCallbackArgument.prototype, "range", {
      get: function() {
        var endPosition, matchEndIndex, matchStartIndex, startPosition;
        if (this.computedRange != null) {
          return this.computedRange;
        }
        matchStartIndex = this.match.index;
        matchEndIndex = matchStartIndex + this.matchText.length;
        startPosition = this.buffer.positionForCharacterIndex(matchStartIndex + this.lengthDelta);
        endPosition = this.buffer.positionForCharacterIndex(matchEndIndex + this.lengthDelta);
        return this.computedRange = new Range(startPosition, endPosition);
      },
      set: function(range) {
        return this.computedRange = range;
      }
    });

    function SearchCallbackArgument(buffer, match, lengthDelta) {
      this.buffer = buffer;
      this.match = match;
      this.lengthDelta = lengthDelta;
      this.stop = __bind(this.stop, this);
      this.replace = __bind(this.replace, this);
      this.stopped = false;
      this.replacementText = null;
      this.matchText = this.match[0];
    }

    SearchCallbackArgument.prototype.getReplacementDelta = function() {
      if (this.replacementText == null) {
        return 0;
      }
      return this.replacementText.length - this.matchText.length;
    };

    SearchCallbackArgument.prototype.replace = function(text) {
      this.replacementText = text;
      return this.buffer.setTextInRange(this.range, this.replacementText);
    };

    SearchCallbackArgument.prototype.stop = function() {
      return this.stopped = true;
    };

    SearchCallbackArgument.prototype.keepLooping = function() {
      return this.stopped === false;
    };

    return SearchCallbackArgument;

  })();

  TransactionAbortedError = (function(_super) {
    __extends(TransactionAbortedError, _super);

    function TransactionAbortedError() {
      TransactionAbortedError.__super__.constructor.apply(this, arguments);
    }

    return TransactionAbortedError;

  })(Error);

  module.exports = TextBuffer = (function() {
    TextBuffer.version = 2;

    TextBuffer.Point = Point;

    TextBuffer.Range = Range;

    TextBuffer.Patch = Patch;

    TextBuffer.newlineRegex = newlineRegex;

    Serializable.includeInto(TextBuffer);

    TextBuffer.prototype.cachedText = null;

    TextBuffer.prototype.encoding = null;

    TextBuffer.prototype.stoppedChangingDelay = 300;

    TextBuffer.prototype.stoppedChangingTimeout = null;

    TextBuffer.prototype.conflict = false;

    TextBuffer.prototype.refcount = 0;

    TextBuffer.prototype.backwardsScanChunkSize = 8000;

    TextBuffer.prototype.defaultMaxUndoEntries = 10000;

    TextBuffer.prototype.changeCount = 0;


    /*
    Section: Construction
     */

    function TextBuffer(params) {
      var maxUndoEntries, text, _ref2, _ref3, _ref4, _ref5;
      if (typeof params === 'string') {
        text = params;
      }
      this.emitter = new Emitter;
      this.lines = [''];
      this.lineEndings = [''];
      this.offsetIndex = new SpanSkipList('rows', 'characters');
      this.setTextInRange([[0, 0], [0, 0]], (_ref2 = text != null ? text : params != null ? params.text : void 0) != null ? _ref2 : '', {
        normalizeLineEndings: false
      });
      maxUndoEntries = (_ref3 = params != null ? params.maxUndoEntries : void 0) != null ? _ref3 : this.defaultMaxUndoEntries;
      this.history = (_ref4 = params != null ? params.history : void 0) != null ? _ref4 : new History(this, maxUndoEntries);
      this.markerStore = (_ref5 = params != null ? params.markerStore : void 0) != null ? _ref5 : new MarkerStore(this);
      this.setEncoding(params != null ? params.encoding : void 0);
      this.setPreferredLineEnding(params != null ? params.preferredLineEnding : void 0);
      this.loaded = false;
      this.transactCallDepth = 0;
    }

    TextBuffer.prototype.deserializeParams = function(params) {
      params.markerStore = MarkerStore.deserialize(this, params.markerStore);
      params.history = History.deserialize(this, params.history);
      return params;
    };

    TextBuffer.prototype.serializeParams = function() {
      return {
        text: this.getText(),
        markerStore: this.markerStore.serialize(),
        history: this.history.serialize(),
        encoding: this.getEncoding(),
        preferredLineEnding: this.preferredLineEnding
      };
    };


    /*
    Section: Event Subscription
     */

    TextBuffer.prototype.onWillChange = function(callback) {
      return this.emitter.on('will-change', callback);
    };

    TextBuffer.prototype.onDidChange = function(callback) {
      return this.emitter.on('did-change', callback);
    };

    TextBuffer.prototype.preemptDidChange = function(callback) {
      return this.emitter.preempt('did-change', callback);
    };

    TextBuffer.prototype.onDidStopChanging = function(callback) {
      return this.emitter.on('did-stop-changing', callback);
    };

    TextBuffer.prototype.onDidUpdateMarkers = function(callback) {
      return this.emitter.on('did-update-markers', callback);
    };

    TextBuffer.prototype.onDidCreateMarker = function(callback) {
      return this.emitter.on('did-create-marker', callback);
    };

    TextBuffer.prototype.onDidChangeEncoding = function(callback) {
      return this.emitter.on('did-change-encoding', callback);
    };

    TextBuffer.prototype.onDidDestroy = function(callback) {
      return this.emitter.on('did-destroy', callback);
    };

    TextBuffer.prototype.getStoppedChangingDelay = function() {
      return this.stoppedChangingDelay;
    };


    /*
    Section: File Details
     */

    TextBuffer.prototype.setEncoding = function(encoding) {
      if (encoding == null) {
        encoding = 'utf8';
      }
      if (encoding === this.getEncoding()) {
        return;
      }
      this.encoding = encoding;
      this.emitter.emit('did-change-encoding', encoding);
    };

    TextBuffer.prototype.getEncoding = function() {
      return this.encoding;
    };

    TextBuffer.prototype.setPreferredLineEnding = function(preferredLineEnding) {
      if (preferredLineEnding == null) {
        preferredLineEnding = null;
      }
      return this.preferredLineEnding = preferredLineEnding;
    };

    TextBuffer.prototype.getPreferredLineEnding = function() {
      return this.preferredLineEnding;
    };


    /*
    Section: Reading Text
     */

    TextBuffer.prototype.isEmpty = function() {
      return this.getLastRow() === 0 && this.lineLengthForRow(0) === 0;
    };

    TextBuffer.prototype.getText = function() {
      var row, text, _i, _ref2;
      if (this.cachedText != null) {
        return this.cachedText;
      } else {
        text = '';
        for (row = _i = 0, _ref2 = this.getLastRow(); 0 <= _ref2 ? _i <= _ref2 : _i >= _ref2; row = 0 <= _ref2 ? ++_i : --_i) {
          text += this.lineForRow(row) + this.lineEndingForRow(row);
        }
        return this.cachedText = text;
      }
    };

    TextBuffer.prototype.getTextInRange = function(range) {
      var endRow, line, row, startRow, text, _i;
      range = this.clipRange(Range.fromObject(range));
      startRow = range.start.row;
      endRow = range.end.row;
      if (startRow === endRow) {
        return this.lineForRow(startRow).slice(range.start.column, range.end.column);
      } else {
        text = '';
        for (row = _i = startRow; startRow <= endRow ? _i <= endRow : _i >= endRow; row = startRow <= endRow ? ++_i : --_i) {
          line = this.lineForRow(row);
          if (row === startRow) {
            text += line.slice(range.start.column);
          } else if (row === endRow) {
            text += line.slice(0, range.end.column);
            continue;
          } else {
            text += line;
          }
          text += this.lineEndingForRow(row);
        }
        return text;
      }
    };

    TextBuffer.prototype.getLines = function() {
      return this.lines.slice();
    };

    TextBuffer.prototype.getLastLine = function() {
      return this.lineForRow(this.getLastRow());
    };

    TextBuffer.prototype.lineForRow = function(row) {
      return this.lines[row];
    };

    TextBuffer.prototype.lineEndingForRow = function(row) {
      return this.lineEndings[row];
    };

    TextBuffer.prototype.lineLengthForRow = function(row) {
      return this.lines[row].length;
    };

    TextBuffer.prototype.isRowBlank = function(row) {
      return !/\S/.test(this.lineForRow(row));
    };

    TextBuffer.prototype.previousNonBlankRow = function(startRow) {
      var row, _i, _ref2;
      if (startRow === 0) {
        return null;
      }
      startRow = Math.min(startRow, this.getLastRow());
      for (row = _i = _ref2 = startRow - 1; _ref2 <= 0 ? _i <= 0 : _i >= 0; row = _ref2 <= 0 ? ++_i : --_i) {
        if (!this.isRowBlank(row)) {
          return row;
        }
      }
      return null;
    };

    TextBuffer.prototype.nextNonBlankRow = function(startRow) {
      var lastRow, row, _i, _ref2;
      lastRow = this.getLastRow();
      if (startRow < lastRow) {
        for (row = _i = _ref2 = startRow + 1; _ref2 <= lastRow ? _i <= lastRow : _i >= lastRow; row = _ref2 <= lastRow ? ++_i : --_i) {
          if (!this.isRowBlank(row)) {
            return row;
          }
        }
      }
      return null;
    };


    /*
    Section: Mutating Text
     */

    TextBuffer.prototype.setText = function(text) {
      return this.setTextInRange(this.getRange(), text, {
        normalizeLineEndings: false
      });
    };

    TextBuffer.prototype.setTextViaDiff = function(text) {
      var computeBufferColumn, currentText, endsWithNewline;
      currentText = this.getText();
      if (currentText === text) {
        return;
      }
      endsWithNewline = function(str) {
        return /[\r\n]+$/g.test(str);
      };
      computeBufferColumn = function(str) {
        var newlineIndex;
        newlineIndex = Math.max(str.lastIndexOf('\n'), str.lastIndexOf('\r'));
        if (endsWithNewline(str)) {
          return 0;
        } else if (newlineIndex === -1) {
          return str.length;
        } else {
          return str.length - newlineIndex - 1;
        }
      };
      return this.transact((function(_this) {
        return function() {
          var change, changeOptions, column, currentPosition, endColumn, endRow, lineCount, lineDiff, row, _i, _len, _ref2, _ref3;
          row = 0;
          column = 0;
          currentPosition = [0, 0];
          lineDiff = diff.diffLines(currentText, text);
          changeOptions = {
            normalizeLineEndings: false
          };
          for (_i = 0, _len = lineDiff.length; _i < _len; _i++) {
            change = lineDiff[_i];
            lineCount = (_ref2 = (_ref3 = change.value.match(newlineRegex)) != null ? _ref3.length : void 0) != null ? _ref2 : 0;
            currentPosition[0] = row;
            currentPosition[1] = column;
            if (change.added) {
              _this.setTextInRange([currentPosition, currentPosition], change.value, changeOptions);
              row += lineCount;
              column = computeBufferColumn(change.value);
            } else if (change.removed) {
              endRow = row + lineCount;
              endColumn = column + computeBufferColumn(change.value);
              _this.setTextInRange([currentPosition, [endRow, endColumn]], '', changeOptions);
            } else {
              row += lineCount;
              column = computeBufferColumn(change.value);
            }
          }
        };
      })(this));
    };

    TextBuffer.prototype.setTextInRange = function(range, newText, options) {
      var newRange, normalizeLineEndings, oldRange, oldText, undo;
      if (this.transactCallDepth === 0) {
        return this.transact((function(_this) {
          return function() {
            return _this.setTextInRange(range, newText, options);
          };
        })(this));
      }
      if (Grim.includeDeprecatedAPIs && typeof options === 'boolean') {
        normalizeLineEndings = options;
        Grim.deprecate("The normalizeLineEndings argument is now an options hash. Use {normalizeLineEndings: " + options + "} instead");
      } else if (options != null) {
        normalizeLineEndings = options.normalizeLineEndings, undo = options.undo;
      }
      if (normalizeLineEndings == null) {
        normalizeLineEndings = true;
      }
      oldRange = this.clipRange(range);
      oldText = this.getTextInRange(oldRange);
      newRange = Range.fromText(oldRange.start, newText);
      this.applyChange({
        oldRange: oldRange,
        newRange: newRange,
        oldText: oldText,
        newText: newText,
        normalizeLineEndings: normalizeLineEndings
      }, undo === 'skip');
      return newRange;
    };

    TextBuffer.prototype.insert = function(position, text, options) {
      return this.setTextInRange(new Range(position, position), text, options);
    };

    TextBuffer.prototype.append = function(text, options) {
      return this.insert(this.getEndPosition(), text, options);
    };

    TextBuffer.prototype.applyChange = function(change, skipUndo) {
      var changeEvent, endRow, ending, lastIndex, lastLine, lastLineEnding, line, lineEndings, lineStartIndex, lines, newExtent, newRange, newText, normalizeLineEndings, normalizedEnding, normalizedNewText, offsets, oldExtent, oldRange, oldText, prefix, result, rowCount, startRow, suffix, _ref2, _ref3, _ref4;
      oldRange = change.oldRange, newRange = change.newRange, oldText = change.oldText, newText = change.newText, normalizeLineEndings = change.normalizeLineEndings;
      oldRange.freeze();
      newRange.freeze();
      this.cachedText = null;
      startRow = oldRange.start.row;
      endRow = oldRange.end.row;
      rowCount = endRow - startRow + 1;
      oldExtent = oldRange.getExtent();
      newExtent = newRange.getExtent();
      if (normalizeLineEndings) {
        normalizedEnding = (_ref2 = this.preferredLineEnding) != null ? _ref2 : this.lineEndingForRow(startRow);
        if (!normalizedEnding) {
          if (startRow > 0) {
            normalizedEnding = this.lineEndingForRow(startRow - 1);
          } else {
            normalizedEnding = null;
          }
        }
      }
      lines = [];
      lineEndings = [];
      lineStartIndex = 0;
      normalizedNewText = "";
      while (result = newlineRegex.exec(newText)) {
        line = newText.slice(lineStartIndex, result.index);
        ending = normalizedEnding != null ? normalizedEnding : result[0];
        lines.push(line);
        lineEndings.push(ending);
        normalizedNewText += line + ending;
        lineStartIndex = newlineRegex.lastIndex;
      }
      lastLine = newText.slice(lineStartIndex);
      lines.push(lastLine);
      lineEndings.push('');
      normalizedNewText += lastLine;
      newText = normalizedNewText;
      changeEvent = Object.freeze({
        oldRange: oldRange,
        newRange: newRange,
        oldText: oldText,
        newText: newText
      });
      this.emitter.emit('will-change', changeEvent);
      prefix = this.lineForRow(startRow).slice(0, oldRange.start.column);
      lines[0] = prefix + lines[0];
      suffix = this.lineForRow(endRow).slice(oldRange.end.column);
      lastIndex = lines.length - 1;
      lines[lastIndex] += suffix;
      lastLineEnding = this.lineEndingForRow(endRow);
      if (lastLineEnding !== '' && (normalizedEnding != null)) {
        lastLineEnding = normalizedEnding;
      }
      lineEndings[lastIndex] = lastLineEnding;
      spliceArray(this.lines, startRow, rowCount, lines);
      spliceArray(this.lineEndings, startRow, rowCount, lineEndings);
      offsets = lines.map(function(line, index) {
        return {
          rows: 1,
          characters: line.length + lineEndings[index].length
        };
      });
      this.offsetIndex.spliceArray('rows', startRow, rowCount, offsets);
      if ((_ref3 = this.markerStore) != null) {
        _ref3.splice(oldRange.start, oldRange.getExtent(), newRange.getExtent());
      }
      if (!skipUndo) {
        if ((_ref4 = this.history) != null) {
          _ref4.pushChange(change);
        }
      }
      this.changeCount++;
      this.emitter.emit('did-change', changeEvent);
      if (Grim.includeDeprecatedAPIs) {
        return this.emit('changed', changeEvent);
      }
    };

    TextBuffer.prototype["delete"] = function(range) {
      return this.setTextInRange(range, '');
    };

    TextBuffer.prototype.deleteRow = function(row) {
      return this.deleteRows(row, row);
    };

    TextBuffer.prototype.deleteRows = function(startRow, endRow) {
      var endPoint, lastRow, startPoint, _ref2;
      lastRow = this.getLastRow();
      if (startRow > endRow) {
        _ref2 = [endRow, startRow], startRow = _ref2[0], endRow = _ref2[1];
      }
      if (endRow < 0) {
        return new Range(this.getFirstPosition(), this.getFirstPosition());
      }
      if (startRow > lastRow) {
        return new Range(this.getEndPosition(), this.getEndPosition());
      }
      startRow = Math.max(0, startRow);
      endRow = Math.min(lastRow, endRow);
      if (endRow < lastRow) {
        startPoint = new Point(startRow, 0);
        endPoint = new Point(endRow + 1, 0);
      } else {
        if (startRow === 0) {
          startPoint = new Point(startRow, 0);
        } else {
          startPoint = new Point(startRow - 1, this.lineLengthForRow(startRow - 1));
        }
        endPoint = new Point(endRow, this.lineLengthForRow(endRow));
      }
      return this["delete"](new Range(startPoint, endPoint));
    };


    /*
    Section: Markers
     */

    TextBuffer.prototype.markRange = function(range, properties) {
      return this.markerStore.markRange(this.clipRange(range), properties);
    };

    TextBuffer.prototype.markPosition = function(position, properties) {
      return this.markerStore.markPosition(this.clipPosition(position), properties);
    };

    TextBuffer.prototype.getMarkers = function() {
      return this.markerStore.getMarkers();
    };

    TextBuffer.prototype.getMarker = function(id) {
      return this.markerStore.getMarker(id);
    };

    TextBuffer.prototype.findMarkers = function(params) {
      return this.markerStore.findMarkers(params);
    };

    TextBuffer.prototype.getMarkerCount = function() {
      return this.markerStore.getMarkerCount();
    };

    TextBuffer.prototype.destroyMarker = function(id) {
      var _ref2;
      return (_ref2 = this.getMarker(id)) != null ? _ref2.destroy() : void 0;
    };


    /*
    Section: History
     */

    TextBuffer.prototype.undo = function() {
      var change, pop, _i, _len, _ref2;
      if (pop = this.history.popUndoStack()) {
        _ref2 = pop.changes;
        for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
          change = _ref2[_i];
          this.applyChange(change, true);
        }
        this.markerStore.restoreFromSnapshot(pop.snapshot);
        return true;
      } else {
        return false;
      }
    };

    TextBuffer.prototype.redo = function() {
      var change, pop, _i, _len, _ref2;
      if (pop = this.history.popRedoStack()) {
        _ref2 = pop.changes;
        for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
          change = _ref2[_i];
          this.applyChange(change, true);
        }
        this.markerStore.restoreFromSnapshot(pop.snapshot);
        return true;
      } else {
        return false;
      }
    };

    TextBuffer.prototype.transact = function(groupingInterval, fn) {
      var checkpointBefore, exception, result;
      if (typeof groupingInterval === 'function') {
        fn = groupingInterval;
        groupingInterval = 0;
      }
      checkpointBefore = this.history.createCheckpoint(this.markerStore.createSnapshot(false), true);
      try {
        this.transactCallDepth++;
        result = fn();
      } catch (_error) {
        exception = _error;
        this.revertToCheckpoint(checkpointBefore, true);
        if (!(exception instanceof TransactionAbortedError)) {
          throw exception;
        }
        return;
      } finally {
        this.transactCallDepth--;
      }
      this.history.groupChangesSinceCheckpoint(checkpointBefore, this.markerStore.createSnapshot(true), true);
      this.history.applyGroupingInterval(groupingInterval);
      return result;
    };

    TextBuffer.prototype.abortTransaction = function() {
      throw new TransactionAbortedError("Transaction aborted.");
    };

    TextBuffer.prototype.clearUndoStack = function() {
      return this.history.clearUndoStack();
    };

    TextBuffer.prototype.createCheckpoint = function() {
      return this.history.createCheckpoint(this.markerStore.createSnapshot(), false);
    };

    TextBuffer.prototype.revertToCheckpoint = function(checkpoint) {
      var change, truncated, _i, _len, _ref2;
      if (truncated = this.history.truncateUndoStack(checkpoint)) {
        _ref2 = truncated.changes;
        for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
          change = _ref2[_i];
          this.applyChange(change, true);
        }
        this.markerStore.restoreFromSnapshot(truncated.snapshot);
        this.emitter.emit('did-update-markers');
        if (Grim.includeDeprecatedAPIs) {
          this.emit('markers-updated');
        }
        return true;
      } else {
        return false;
      }
    };

    TextBuffer.prototype.groupChangesSinceCheckpoint = function(checkpoint) {
      return this.history.groupChangesSinceCheckpoint(checkpoint, this.markerStore.createSnapshot(false), false);
    };


    /*
    Section: Search And Replace
     */

    TextBuffer.prototype.scan = function(regex, iterator) {
      return this.scanInRange(regex, this.getRange(), (function(_this) {
        return function(result) {
          result.lineText = _this.lineForRow(result.range.start.row);
          result.lineTextOffset = 0;
          return iterator(result);
        };
      })(this));
    };

    TextBuffer.prototype.backwardsScan = function(regex, iterator) {
      return this.backwardsScanInRange(regex, this.getRange(), (function(_this) {
        return function(result) {
          result.lineText = _this.lineForRow(result.range.start.row);
          result.lineTextOffset = 0;
          return iterator(result);
        };
      })(this));
    };

    TextBuffer.prototype.scanInRange = function(regex, range, iterator, reverse) {
      var callbackArgument, endIndex, flags, global, lengthDelta, match, matches, next, startIndex;
      if (reverse == null) {
        reverse = false;
      }
      range = this.clipRange(range);
      global = regex.global;
      flags = "gm";
      if (regex.ignoreCase) {
        flags += "i";
      }
      regex = new RegExp(regex.source, flags);
      startIndex = this.characterIndexForPosition(range.start);
      endIndex = this.characterIndexForPosition(range.end);
      if (reverse) {
        matches = new MatchIterator.Backwards(this.getText(), regex, startIndex, endIndex, this.backwardsScanChunkSize);
      } else {
        matches = new MatchIterator.Forwards(this.getText(), regex, startIndex, endIndex);
      }
      lengthDelta = 0;
      while (!(next = matches.next()).done) {
        match = next.value;
        callbackArgument = new SearchCallbackArgument(this, match, lengthDelta);
        iterator(callbackArgument);
        if (!reverse) {
          lengthDelta += callbackArgument.getReplacementDelta();
        }
        if (!(global && callbackArgument.keepLooping())) {
          break;
        }
      }
    };

    TextBuffer.prototype.backwardsScanInRange = function(regex, range, iterator) {
      return this.scanInRange(regex, range, iterator, true);
    };

    TextBuffer.prototype.replace = function(regex, replacementText) {
      var replacements;
      replacements = 0;
      this.transact((function(_this) {
        return function() {
          return _this.scan(regex, function(_arg) {
            var matchText, replace;
            matchText = _arg.matchText, replace = _arg.replace;
            replace(matchText.replace(regex, replacementText));
            return replacements++;
          });
        };
      })(this));
      return replacements;
    };


    /*
    Section: Buffer Range Details
     */

    TextBuffer.prototype.getRange = function() {
      return new Range(this.getFirstPosition(), this.getEndPosition());
    };

    TextBuffer.prototype.getLineCount = function() {
      return this.lines.length;
    };

    TextBuffer.prototype.getLastRow = function() {
      return this.getLineCount() - 1;
    };

    TextBuffer.prototype.getFirstPosition = function() {
      return new Point(0, 0);
    };

    TextBuffer.prototype.getEndPosition = function() {
      var lastRow;
      lastRow = this.getLastRow();
      return new Point(lastRow, this.lineLengthForRow(lastRow));
    };

    TextBuffer.prototype.getMaxCharacterIndex = function() {
      return this.offsetIndex.totalTo(Infinity, 'rows').characters;
    };

    TextBuffer.prototype.rangeForRow = function(row, includeNewline) {
      if (Grim.includeDeprecatedAPIs && typeof includeNewline === 'object') {
        Grim.deprecate("The second param is no longer an object, it's a boolean argument named `includeNewline`.");
        includeNewline = includeNewline.includeNewline;
      }
      row = Math.max(row, 0);
      row = Math.min(row, this.getLastRow());
      if (includeNewline && row < this.getLastRow()) {
        return new Range(new Point(row, 0), new Point(row + 1, 0));
      } else {
        return new Range(new Point(row, 0), new Point(row, this.lineLengthForRow(row)));
      }
    };

    TextBuffer.prototype.characterIndexForPosition = function(position) {
      var characters, column, row, _ref2;
      _ref2 = this.clipPosition(Point.fromObject(position)), row = _ref2.row, column = _ref2.column;
      if (row < 0 || row > this.getLastRow() || column < 0 || column > this.lineLengthForRow(row)) {
        throw new Error("Position " + position + " is invalid");
      }
      characters = this.offsetIndex.totalTo(row, 'rows').characters;
      return characters + column;
    };

    TextBuffer.prototype.positionForCharacterIndex = function(offset) {
      var characters, rows, _ref2;
      offset = Math.max(0, offset);
      offset = Math.min(this.getMaxCharacterIndex(), offset);
      _ref2 = this.offsetIndex.totalTo(offset, 'characters'), rows = _ref2.rows, characters = _ref2.characters;
      if (rows > this.getLastRow()) {
        return this.getEndPosition();
      } else {
        return new Point(rows, offset - characters);
      }
    };

    TextBuffer.prototype.clipRange = function(range) {
      var end, start;
      range = Range.fromObject(range);
      start = this.clipPosition(range.start);
      end = this.clipPosition(range.end);
      if (range.start.isEqual(start) && range.end.isEqual(end)) {
        return range;
      } else {
        return new Range(start, end);
      }
    };

    TextBuffer.prototype.clipPosition = function(position) {
      var column, row;
      position = Point.fromObject(position);
      Point.assertValid(position);
      row = position.row, column = position.column;
      if (row < 0) {
        return this.getFirstPosition();
      } else if (row > this.getLastRow()) {
        return this.getEndPosition();
      } else {
        column = Math.min(Math.max(column, 0), this.lineLengthForRow(row));
        if (column === position.column) {
          return position;
        } else {
          return new Point(row, column);
        }
      }
    };


    /*
    Section: Private Utility Methods
     */

    TextBuffer.prototype.destroy = function() {
      if (!this.destroyed) {
        this.cancelStoppedChangingTimeout();
        if (Grim.includeDeprecatedAPIs) {
          this.unsubscribe();
        }
        this.destroyed = true;
        this.emitter.emit('did-destroy');
        if (Grim.includeDeprecatedAPIs) {
          return this.emit('destroyed');
        }
      }
    };

    TextBuffer.prototype.isAlive = function() {
      return !this.destroyed;
    };

    TextBuffer.prototype.isDestroyed = function() {
      return this.destroyed;
    };

    TextBuffer.prototype.isRetained = function() {
      return this.refcount > 0;
    };

    TextBuffer.prototype.retain = function() {
      this.refcount++;
      return this;
    };

    TextBuffer.prototype.release = function() {
      this.refcount--;
      if (!this.isRetained()) {
        this.destroy();
      }
      return this;
    };

    TextBuffer.prototype.hasMultipleEditors = function() {
      return this.refcount > 1;
    };

    TextBuffer.prototype.logLines = function(start, end) {
      var line, row, _i;
      if (start == null) {
        start = 0;
      }
      if (end == null) {
        end = this.getLastRow();
      }
      for (row = _i = start; start <= end ? _i <= end : _i >= end; row = start <= end ? ++_i : --_i) {
        line = this.lineForRow(row);
        console.log(row, line, line.length);
      }
    };


    /*
    Section: Private History Delegate Methods
     */

    TextBuffer.prototype.invertChange = function(change) {
      return Object.freeze({
        oldRange: change.newRange,
        newRange: change.oldRange,
        oldText: change.newText,
        newText: change.oldText
      });
    };

    TextBuffer.prototype.serializeChange = function(change) {
      return {
        oldRange: change.oldRange.serialize(),
        newRange: change.newRange.serialize(),
        oldText: change.oldText,
        newText: change.newText
      };
    };

    TextBuffer.prototype.deserializeChange = function(change) {
      return {
        oldRange: Range.deserialize(change.oldRange),
        newRange: Range.deserialize(change.newRange),
        oldText: change.oldText,
        newText: change.newText
      };
    };

    TextBuffer.prototype.serializeSnapshot = function(snapshot) {
      return MarkerStore.serializeSnapshot(snapshot);
    };

    TextBuffer.prototype.deserializeSnapshot = function(snapshot) {
      return MarkerStore.deserializeSnapshot(snapshot);
    };


    /*
    Section: Private MarkerStore Delegate Methods
     */

    TextBuffer.prototype.markerCreated = function(marker) {
      this.emitter.emit('did-create-marker', marker);
      if (Grim.includeDeprecatedAPIs) {
        return this.emit('marker-created', marker);
      }
    };

    TextBuffer.prototype.markersUpdated = function() {
      this.emitter.emit('did-update-markers');
      if (Grim.includeDeprecatedAPIs) {
        return this.emit('markers-updated');
      }
    };

    return TextBuffer;

  })();

  if (Grim.includeDeprecatedAPIs) {
    EmitterMixin = require('emissary').Emitter;
    EmitterMixin.includeInto(TextBuffer);
    Subscriber = require('emissary').Subscriber;
    Subscriber.includeInto(TextBuffer);
    TextBuffer.prototype.on = function(eventName) {
      switch (eventName) {
        case 'changed':
          Grim.deprecate("Use TextBuffer::onDidChange instead");
          break;
        case 'markers-updated':
          Grim.deprecate("Use TextBuffer::onDidUpdateMarkers instead");
          break;
        case 'marker-created':
          Grim.deprecate("Use TextBuffer::onDidCreateMarker instead");
          break;
        case 'destroyed':
          Grim.deprecate("Use TextBuffer::onDidDestroy instead");
          break;
        default:
          Grim.deprecate("TextBuffer::on is deprecated. Use event subscription methods instead.");
      }
      return EmitterMixin.prototype.on.apply(this, arguments);
    };
    TextBuffer.prototype.change = function(oldRange, newText, options) {
      if (options == null) {
        options = {};
      }
      Grim.deprecate("Use TextBuffer::setTextInRange instead.");
      return this.setTextInRange(oldRange, newText, options.normalizeLineEndings);
    };
    TextBuffer.prototype.usesSoftTabs = function() {
      var match, row, _i, _ref2;
      Grim.deprecate("Use TextEditor::usesSoftTabs instead. TextBuffer doesn't have enough context to determine this.");
      for (row = _i = 0, _ref2 = this.getLastRow(); 0 <= _ref2 ? _i <= _ref2 : _i >= _ref2; row = 0 <= _ref2 ? ++_i : --_i) {
        if (match = this.lineForRow(row).match(/^\s/)) {
          return match[0][0] !== '\t';
        }
      }
      return void 0;
    };
    TextBuffer.prototype.getEofPosition = function() {
      Grim.deprecate("Use TextBuffer::getEndPosition instead.");
      return this.getEndPosition();
    };
    TextBuffer.prototype.beginTransaction = function(groupingInterval) {
      return Grim.deprecate("Open-ended transactions are deprecated. Use checkpoints instead.");
    };
    TextBuffer.prototype.commitTransaction = function() {
      return Grim.deprecate("Open-ended transactions are deprecated. Use checkpoints instead.");
    };
  }

}).call(this);
