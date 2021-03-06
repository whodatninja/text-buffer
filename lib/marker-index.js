(function() {
  var BRANCHING_THRESHOLD, Leaf, MarkerIndex, Node, Point, Range, addSet, assertValidId, extend, intersectSet, last, setEqual, setsOverlap, subtractSet, templateRange, _ref, _ref1,
    __slice = [].slice;

  Point = require("./point");

  Range = require("./range");

  _ref = require("underscore-plus"), last = _ref.last, extend = _ref.extend;

  _ref1 = require("./set-helpers"), addSet = _ref1.addSet, subtractSet = _ref1.subtractSet, intersectSet = _ref1.intersectSet, setEqual = _ref1.setEqual;

  BRANCHING_THRESHOLD = 3;

  Node = (function() {
    function Node(children) {
      var child, _i, _len, _ref2;
      this.children = children;
      this.ids = new Set;
      this.extent = Point.ZERO;
      _ref2 = this.children;
      for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
        child = _ref2[_i];
        this.extent = this.extent.traverse(child.extent);
        addSet(this.ids, child.ids);
      }
    }

    Node.prototype.insert = function(ids, start, end) {
      var child, childEnd, childFollowsRange, childPrecedesRange, childStart, i, newChildren, newNodes, rangeIsEmpty, relativeEnd, relativeStart, _ref2;
      rangeIsEmpty = start.compare(end) === 0;
      childEnd = Point.ZERO;
      i = 0;
      while (i < this.children.length) {
        child = this.children[i++];
        childStart = childEnd;
        childEnd = childStart.traverse(child.extent);
        switch (childEnd.compare(start)) {
          case -1:
            childPrecedesRange = true;
            break;
          case 1:
            childPrecedesRange = false;
            break;
          case 0:
            if (child.hasEmptyRightmostLeaf()) {
              childPrecedesRange = false;
            } else {
              childPrecedesRange = true;
              if (rangeIsEmpty) {
                ids = new Set(ids);
                child.findContaining(child.extent, ids);
              }
            }
        }
        if (childPrecedesRange) {
          continue;
        }
        switch (childStart.compare(end)) {
          case -1:
            childFollowsRange = false;
            break;
          case 1:
            childFollowsRange = true;
            break;
          case 0:
            childFollowsRange = !(child.hasEmptyLeftmostLeaf() || rangeIsEmpty);
        }
        if (childFollowsRange) {
          break;
        }
        relativeStart = Point.max(Point.ZERO, start.traversalFrom(childStart));
        relativeEnd = Point.min(child.extent, end.traversalFrom(childStart));
        if (newChildren = child.insert(ids, relativeStart, relativeEnd)) {
          (_ref2 = this.children).splice.apply(_ref2, [i - 1, 1].concat(__slice.call(newChildren)));
          i += newChildren.length - 1;
        }
        if (rangeIsEmpty) {
          break;
        }
      }
      if (newNodes = this.splitIfNeeded()) {
        return newNodes;
      } else {
        addSet(this.ids, ids);
      }
    };

    Node.prototype["delete"] = function(id) {
      var i, _results;
      if (!this.ids["delete"](id)) {
        return;
      }
      i = 0;
      _results = [];
      while (i < this.children.length) {
        this.children[i]["delete"](id);
        if (!this.mergeChildrenIfNeeded(i - 1)) {
          _results.push(i++);
        } else {
          _results.push(void 0);
        }
      }
      return _results;
    };

    Node.prototype.splice = function(position, oldExtent, newExtent, exclusiveIds, precedingIds, followingIds) {
      var child, childEnd, childPrecedesRange, childStart, extentAfterChange, i, nextChildIds, oldRangeIsEmpty, previousChildIds, previousExtent, remainderToDelete, spliceNewEnd, spliceOldEnd, splitNodes, _ref2, _ref3, _ref4, _ref5, _ref6;
      oldRangeIsEmpty = oldExtent.isZero();
      spliceOldEnd = position.traverse(oldExtent);
      spliceNewEnd = position.traverse(newExtent);
      extentAfterChange = this.extent.traversalFrom(spliceOldEnd);
      this.extent = spliceNewEnd.traverse(Point.max(Point.ZERO, extentAfterChange));
      if (position.isZero() && oldRangeIsEmpty) {
        if (precedingIds != null) {
          precedingIds.forEach((function(_this) {
            return function(id) {
              if (!exclusiveIds.has(id)) {
                return _this.ids.add(id);
              }
            };
          })(this));
        }
      }
      i = 0;
      childEnd = Point.ZERO;
      while (i < this.children.length) {
        child = this.children[i];
        childStart = childEnd;
        childEnd = childStart.traverse(child.extent);
        switch (childEnd.compare(position)) {
          case -1:
            childPrecedesRange = true;
            break;
          case 0:
            childPrecedesRange = !(child.hasEmptyRightmostLeaf() && oldRangeIsEmpty);
            break;
          case 1:
            childPrecedesRange = false;
        }
        if (!childPrecedesRange) {
          if (typeof remainderToDelete !== "undefined" && remainderToDelete !== null) {
            if (remainderToDelete.isPositive()) {
              previousExtent = child.extent;
              child.splice(Point.ZERO, remainderToDelete, Point.ZERO);
              remainderToDelete = remainderToDelete.traversalFrom(previousExtent);
              childEnd = childStart.traverse(child.extent);
            }
          } else {
            if (oldRangeIsEmpty) {
              previousChildIds = (_ref2 = (_ref3 = this.children[i - 1]) != null ? _ref3.getRightmostIds() : void 0) != null ? _ref2 : precedingIds;
              nextChildIds = (_ref4 = (_ref5 = this.children[i + 1]) != null ? _ref5.getLeftmostIds() : void 0) != null ? _ref4 : followingIds;
            }
            splitNodes = child.splice(position.traversalFrom(childStart), oldExtent, newExtent, exclusiveIds, previousChildIds, nextChildIds);
            if (splitNodes) {
              (_ref6 = this.children).splice.apply(_ref6, [i, 1].concat(__slice.call(splitNodes)));
            }
            remainderToDelete = spliceOldEnd.traversalFrom(childEnd);
            childEnd = childStart.traverse(child.extent);
          }
        }
        if (!this.mergeChildrenIfNeeded(i - 1)) {
          i++;
        }
      }
      return this.splitIfNeeded();
    };

    Node.prototype.getStart = function(id) {
      var child, childEnd, childStart, startRelativeToChild, _i, _len, _ref2;
      if (!this.ids.has(id)) {
        return;
      }
      childEnd = Point.ZERO;
      _ref2 = this.children;
      for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
        child = _ref2[_i];
        childStart = childEnd;
        childEnd = childStart.traverse(child.extent);
        if (startRelativeToChild = child.getStart(id)) {
          return childStart.traverse(startRelativeToChild);
        }
      }
    };

    Node.prototype.getEnd = function(id) {
      var child, childEnd, childStart, end, endRelativeToChild, _i, _len, _ref2;
      if (!this.ids.has(id)) {
        return;
      }
      childEnd = Point.ZERO;
      _ref2 = this.children;
      for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
        child = _ref2[_i];
        childStart = childEnd;
        childEnd = childStart.traverse(child.extent);
        if (endRelativeToChild = child.getEnd(id)) {
          end = childStart.traverse(endRelativeToChild);
        } else if (end != null) {
          break;
        }
      }
      return end;
    };

    Node.prototype.dump = function(ids, offset, snapshot) {
      var child, _i, _len, _ref2;
      _ref2 = this.children;
      for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
        child = _ref2[_i];
        if ((!ids) || setsOverlap(ids, child.ids)) {
          offset = child.dump(ids, offset, snapshot);
        } else {
          offset = offset.traverse(child.extent);
        }
      }
      return offset;
    };

    Node.prototype.findContaining = function(point, set) {
      var child, childEnd, childStart, _i, _len, _ref2;
      childEnd = Point.ZERO;
      _ref2 = this.children;
      for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
        child = _ref2[_i];
        childStart = childEnd;
        childEnd = childStart.traverse(child.extent);
        if (childEnd.compare(point) < 0) {
          continue;
        }
        if (childStart.compare(point) > 0) {
          break;
        }
        child.findContaining(point.traversalFrom(childStart), set);
      }
    };

    Node.prototype.findIntersecting = function(start, end, set) {
      var child, childEnd, childStart, _i, _len, _ref2;
      if (start.isZero() && end.compare(this.extent) === 0) {
        addSet(set, this.ids);
        return;
      }
      childEnd = Point.ZERO;
      _ref2 = this.children;
      for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
        child = _ref2[_i];
        childStart = childEnd;
        childEnd = childStart.traverse(child.extent);
        if (childEnd.compare(start) < 0) {
          continue;
        }
        if (childStart.compare(end) > 0) {
          break;
        }
        child.findIntersecting(Point.max(Point.ZERO, start.traversalFrom(childStart)), Point.min(child.extent, end.traversalFrom(childStart)), set);
      }
    };

    Node.prototype.findStartingAt = function(position, result, previousIds) {
      var child, nextPosition, _i, _len, _ref2;
      _ref2 = this.children;
      for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
        child = _ref2[_i];
        if (position.isNegative()) {
          break;
        }
        nextPosition = position.traversalFrom(child.extent);
        if (!nextPosition.isPositive()) {
          child.findStartingAt(position, result, previousIds);
        }
        previousIds = child.ids;
        position = nextPosition;
      }
    };

    Node.prototype.findEndingAt = function(position, result) {
      var child, nextPosition, _i, _len, _ref2;
      _ref2 = this.children;
      for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
        child = _ref2[_i];
        if (position.isNegative()) {
          break;
        }
        nextPosition = position.traversalFrom(child.extent);
        if (!nextPosition.isPositive()) {
          child.findEndingAt(position, result);
        }
        position = nextPosition;
      }
    };

    Node.prototype.hasEmptyRightmostLeaf = function() {
      return this.children[this.children.length - 1].hasEmptyRightmostLeaf();
    };

    Node.prototype.hasEmptyLeftmostLeaf = function() {
      return this.children[0].hasEmptyLeftmostLeaf();
    };

    Node.prototype.getLeftmostIds = function() {
      return this.children[0].getLeftmostIds();
    };

    Node.prototype.getRightmostIds = function() {
      return last(this.children).getRightmostIds();
    };

    Node.prototype.merge = function(other) {
      var childCount, _ref2;
      childCount = this.children.length + other.children.length;
      if (childCount <= BRANCHING_THRESHOLD + 1) {
        if (last(this.children).merge(other.children[0])) {
          other.children.shift();
          childCount--;
        }
        if (childCount <= BRANCHING_THRESHOLD) {
          this.extent = this.extent.traverse(other.extent);
          addSet(this.ids, other.ids);
          (_ref2 = this.children).push.apply(_ref2, other.children);
          return true;
        }
      }
      return false;
    };

    Node.prototype.splitIfNeeded = function() {
      var branchingRatio, splitIndex;
      if ((branchingRatio = this.children.length / BRANCHING_THRESHOLD) > 1) {
        splitIndex = Math.ceil(branchingRatio);
        return [new Node(this.children.slice(0, splitIndex)), new Node(this.children.slice(splitIndex))];
      }
    };

    Node.prototype.mergeChildrenIfNeeded = function(i) {
      var _ref2;
      if ((_ref2 = this.children[i]) != null ? _ref2.merge(this.children[i + 1]) : void 0) {
        this.children.splice(i + 1, 1);
        return true;
      } else {
        return false;
      }
    };

    Node.prototype.toString = function(indentLevel) {
      var i, ids, indent, next, values, _i;
      if (indentLevel == null) {
        indentLevel = 0;
      }
      indent = "";
      for (i = _i = 0; _i < indentLevel; i = _i += 1) {
        indent += " ";
      }
      ids = [];
      values = this.ids.values();
      while (!(next = values.next()).done) {
        ids.push(next.value);
      }
      return "" + indent + "Node " + this.extent + " (" + (ids.join(" ")) + ")\n" + (this.children.map(function(c) {
        return c.toString(indentLevel + 2);
      }).join("\n"));
    };

    return Node;

  })();

  Leaf = (function() {
    function Leaf(extent, ids) {
      this.extent = extent;
      this.ids = ids;
    }

    Leaf.prototype.insert = function(ids, start, end) {
      var newIds, newLeaves;
      if (start.isZero() && end.compare(this.extent) === 0) {
        addSet(this.ids, ids);
      } else {
        newIds = new Set(this.ids);
        addSet(newIds, ids);
        newLeaves = [];
        if (start.isPositive()) {
          newLeaves.push(new Leaf(start, new Set(this.ids)));
        }
        newLeaves.push(new Leaf(end.traversalFrom(start), newIds));
        if (this.extent.compare(end) > 0) {
          newLeaves.push(new Leaf(this.extent.traversalFrom(end), new Set(this.ids)));
        }
        return newLeaves;
      }
    };

    Leaf.prototype["delete"] = function(id) {
      return this.ids["delete"](id);
    };

    Leaf.prototype.splice = function(position, spliceOldExtent, spliceNewExtent, exclusiveIds, precedingIds, followingIds) {
      var extentAfterChange, leftIds, spliceNewEnd, spliceOldEnd;
      if (position.isZero() && spliceOldExtent.isZero()) {
        leftIds = new Set(precedingIds);
        addSet(leftIds, this.ids);
        subtractSet(leftIds, exclusiveIds);
        if (this.extent.isZero()) {
          precedingIds.forEach((function(_this) {
            return function(id) {
              if (!followingIds.has(id)) {
                return _this.ids["delete"](id);
              }
            };
          })(this));
        }
        return [new Leaf(spliceNewExtent, leftIds), this];
      } else {
        spliceOldEnd = position.traverse(spliceOldExtent);
        spliceNewEnd = position.traverse(spliceNewExtent);
        extentAfterChange = this.extent.traversalFrom(spliceOldEnd);
        this.extent = spliceNewEnd.traverse(Point.max(Point.ZERO, extentAfterChange));
      }
    };

    Leaf.prototype.getStart = function(id) {
      if (this.ids.has(id)) {
        return Point.ZERO;
      }
    };

    Leaf.prototype.getEnd = function(id) {
      if (this.ids.has(id)) {
        return this.extent;
      }
    };

    Leaf.prototype.dump = function(ids, offset, snapshot) {
      var end, id, next, values, _base;
      end = offset.traverse(this.extent);
      values = this.ids.values();
      while (!(next = values.next()).done) {
        id = next.value;
        if ((!ids) || ids.has(id)) {
          if (snapshot[id] == null) {
            snapshot[id] = templateRange();
          }
          if ((_base = snapshot[id]).start == null) {
            _base.start = offset;
          }
          snapshot[id].end = end;
        }
      }
      return end;
    };

    Leaf.prototype.findEndingAt = function(position, result) {
      if (position.isEqual(this.extent)) {
        addSet(result, this.ids);
      } else if (position.isZero()) {
        subtractSet(result, this.ids);
      }
    };

    Leaf.prototype.findStartingAt = function(position, result, previousIds) {
      if (position.isZero()) {
        this.ids.forEach(function(id) {
          if (!previousIds.has(id)) {
            return result.add(id);
          }
        });
      }
    };

    Leaf.prototype.findContaining = function(point, set) {
      return addSet(set, this.ids);
    };

    Leaf.prototype.findIntersecting = function(start, end, set) {
      return addSet(set, this.ids);
    };

    Leaf.prototype.hasEmptyRightmostLeaf = function() {
      return this.extent.isZero();
    };

    Leaf.prototype.hasEmptyLeftmostLeaf = function() {
      return this.extent.isZero();
    };

    Leaf.prototype.getLeftmostIds = function() {
      return this.ids;
    };

    Leaf.prototype.getRightmostIds = function() {
      return this.ids;
    };

    Leaf.prototype.merge = function(other) {
      if (setEqual(this.ids, other.ids) || this.extent.isZero() && other.extent.isZero()) {
        this.extent = this.extent.traverse(other.extent);
        addSet(this.ids, other.ids);
        return true;
      } else {
        return false;
      }
    };

    Leaf.prototype.toString = function(indentLevel) {
      var i, ids, indent, next, values, _i;
      if (indentLevel == null) {
        indentLevel = 0;
      }
      indent = "";
      for (i = _i = 0; _i < indentLevel; i = _i += 1) {
        indent += " ";
      }
      ids = [];
      values = this.ids.values();
      while (!(next = values.next()).done) {
        ids.push(next.value);
      }
      return "" + indent + "Leaf " + this.extent + " (" + (ids.join(" ")) + ")";
    };

    return Leaf;

  })();

  module.exports = MarkerIndex = (function() {
    function MarkerIndex() {
      this.clear();
    }

    MarkerIndex.prototype.insert = function(id, start, end) {
      var splitNodes;
      assertValidId(id);
      this.rangeCache[id] = Range(start, end);
      if (splitNodes = this.rootNode.insert(new Set().add(id + ""), start, end)) {
        return this.rootNode = new Node(splitNodes);
      }
    };

    MarkerIndex.prototype["delete"] = function(id) {
      assertValidId(id);
      delete this.rangeCache[id];
      this.rootNode["delete"](id);
      return this.condenseIfNeeded();
    };

    MarkerIndex.prototype.splice = function(position, oldExtent, newExtent) {
      var splitNodes;
      this.clearRangeCache();
      if (splitNodes = this.rootNode.splice(position, oldExtent, newExtent, this.exclusiveIds, new Set, new Set)) {
        this.rootNode = new Node(splitNodes);
      }
      return this.condenseIfNeeded();
    };

    MarkerIndex.prototype.isExclusive = function(id) {
      return this.exclusiveIds.has(id);
    };

    MarkerIndex.prototype.setExclusive = function(id, isExclusive) {
      assertValidId(id);
      if (isExclusive) {
        return this.exclusiveIds.add(id);
      } else {
        return this.exclusiveIds["delete"](id);
      }
    };

    MarkerIndex.prototype.getRange = function(id) {
      var start;
      if (start = this.getStart(id)) {
        return Range(start, this.getEnd(id));
      }
    };

    MarkerIndex.prototype.getStart = function(id) {
      var entry, _base;
      if (!this.rootNode.ids.has(id)) {
        return;
      }
      entry = (_base = this.rangeCache)[id] != null ? _base[id] : _base[id] = templateRange();
      return entry.start != null ? entry.start : entry.start = this.rootNode.getStart(id);
    };

    MarkerIndex.prototype.getEnd = function(id) {
      var entry, _base;
      if (!this.rootNode.ids.has(id)) {
        return;
      }
      entry = (_base = this.rangeCache)[id] != null ? _base[id] : _base[id] = templateRange();
      return entry.end != null ? entry.end : entry.end = this.rootNode.getEnd(id);
    };

    MarkerIndex.prototype.findContaining = function(start, end) {
      var containing, containingEnd;
      containing = new Set;
      this.rootNode.findContaining(start, containing);
      if ((end != null) && end.compare(start) !== 0) {
        containingEnd = new Set;
        this.rootNode.findContaining(end, containingEnd);
        containing.forEach(function(id) {
          if (!containingEnd.has(id)) {
            return containing["delete"](id);
          }
        });
      }
      return containing;
    };

    MarkerIndex.prototype.findContainedIn = function(start, end) {
      var result;
      if (end == null) {
        end = start;
      }
      result = this.findStartingIn(start, end);
      subtractSet(result, this.findIntersecting(end.traverse(Point(0, 1))));
      return result;
    };

    MarkerIndex.prototype.findIntersecting = function(start, end) {
      var intersecting;
      if (end == null) {
        end = start;
      }
      intersecting = new Set;
      this.rootNode.findIntersecting(start, end, intersecting);
      return intersecting;
    };

    MarkerIndex.prototype.findStartingIn = function(start, end) {
      var previousPoint, result;
      if (end != null) {
        result = this.findIntersecting(start, end);
        if (start.isPositive()) {
          if (start.column === 0) {
            previousPoint = Point(start.row - 1, Infinity);
          } else {
            previousPoint = Point(start.row, start.column - 1);
          }
          subtractSet(result, this.findIntersecting(previousPoint));
        }
        return result;
      } else {
        result = new Set;
        this.rootNode.findStartingAt(start, result, new Set);
        return result;
      }
    };

    MarkerIndex.prototype.findEndingIn = function(start, end) {
      var result;
      if (end != null) {
        result = this.findIntersecting(start, end);
        subtractSet(result, this.findIntersecting(end.traverse(Point(0, 1))));
        return result;
      } else {
        result = new Set;
        this.rootNode.findEndingAt(start, result);
        return result;
      }
    };

    MarkerIndex.prototype.clear = function() {
      this.rootNode = new Leaf(Point.INFINITY, new Set);
      this.exclusiveIds = new Set;
      return this.clearRangeCache();
    };

    MarkerIndex.prototype.dump = function(ids) {
      var result;
      result = {};
      this.rootNode.dump(ids, Point.ZERO, result);
      extend(this.rangeCache, result);
      return result;
    };


    /*
    Section: Private
     */

    MarkerIndex.prototype.clearRangeCache = function() {
      return this.rangeCache = {};
    };

    MarkerIndex.prototype.condenseIfNeeded = function() {
      var _ref2;
      while (((_ref2 = this.rootNode.children) != null ? _ref2.length : void 0) === 1) {
        this.rootNode = this.rootNode.children[0];
      }
    };

    return MarkerIndex;

  })();

  assertValidId = function(id) {
    if (typeof id !== 'string') {
      throw new TypeError("Marker ID must be a string");
    }
  };

  templateRange = function() {
    return Object.create(Range.prototype);
  };

  setsOverlap = function(set1, set2) {
    var next, values;
    values = set1.values();
    while (!(next = values.next()).done) {
      if (set2.has(next.value)) {
        return true;
      }
    }
    return false;
  };

}).call(this);
