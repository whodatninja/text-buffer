(function() {
  var Backwards, Forwards;

  Forwards = (function() {
    function Forwards(text, regex, startIndex, endIndex) {
      this.text = text;
      this.regex = regex;
      this.startIndex = startIndex;
      this.endIndex = endIndex;
      this.regex.lastIndex = this.startIndex;
    }

    Forwards.prototype.next = function() {
      var match, matchEndIndex, matchLength, matchStartIndex, submatch;
      if (match = this.regex.exec(this.text)) {
        matchLength = match[0].length;
        matchStartIndex = match.index;
        matchEndIndex = matchStartIndex + matchLength;
        if (matchEndIndex > this.endIndex) {
          this.regex.lastIndex = 0;
          if (matchStartIndex < this.endIndex && (submatch = this.regex.exec(this.text.slice(matchStartIndex, this.endIndex)))) {
            submatch.index = matchStartIndex;
            match = submatch;
          } else {
            match = null;
          }
          this.regex.lastIndex = Infinity;
        } else {
          if (matchLength === 0) {
            matchEndIndex++;
          }
          this.regex.lastIndex = matchEndIndex;
        }
      }
      if (match) {
        return {
          value: match,
          done: false
        };
      } else {
        return {
          value: null,
          done: true
        };
      }
    };

    return Forwards;

  })();

  Backwards = (function() {
    function Backwards(text, regex, startIndex, endIndex, chunkSize) {
      this.text = text;
      this.regex = regex;
      this.startIndex = startIndex;
      this.chunkSize = chunkSize;
      this.bufferedMatches = [];
      this.doneScanning = false;
      this.chunkStartIndex = this.chunkEndIndex = endIndex;
      this.lastMatchIndex = Infinity;
    }

    Backwards.prototype.scanNextChunk = function() {
      var firstResultIndex, match, matchEndIndex, matchLength, matchStartIndex, submatch, _ref;
      this.doneScanning = this.chunkStartIndex === this.startIndex;
      this.chunkEndIndex = Math.min(this.chunkEndIndex, this.lastMatchIndex);
      this.chunkStartIndex = Math.max(this.startIndex, this.chunkStartIndex - this.chunkSize);
      firstResultIndex = null;
      this.regex.lastIndex = this.chunkStartIndex;
      while (match = this.regex.exec(this.text)) {
        matchLength = match[0].length;
        matchStartIndex = match.index;
        matchEndIndex = matchStartIndex + matchLength;
        if ((matchStartIndex === (_ref = this.chunkStartIndex) && _ref > this.startIndex)) {
          break;
        }
        if (matchStartIndex >= this.chunkEndIndex) {
          break;
        }
        if (matchEndIndex > this.chunkEndIndex) {
          this.regex.lastIndex = 0;
          if (submatch = this.regex.exec(this.text.slice(matchStartIndex, this.chunkEndIndex))) {
            submatch.index = matchStartIndex;
            if (firstResultIndex == null) {
              firstResultIndex = matchStartIndex;
            }
            this.bufferedMatches.push(submatch);
          }
          break;
        } else {
          if (firstResultIndex == null) {
            firstResultIndex = matchStartIndex;
          }
          this.bufferedMatches.push(match);
          if (matchLength === 0) {
            matchEndIndex++;
          }
          this.regex.lastIndex = matchEndIndex;
        }
      }
      if (firstResultIndex) {
        return this.lastMatchIndex = firstResultIndex;
      }
    };

    Backwards.prototype.next = function() {
      var match;
      while (!(this.doneScanning || this.bufferedMatches.length > 0)) {
        this.scanNextChunk();
      }
      if (match = this.bufferedMatches.pop()) {
        return {
          value: match,
          done: false
        };
      } else {
        return {
          value: null,
          done: true
        };
      }
    };

    return Backwards;

  })();

  module.exports = {
    Forwards: Forwards,
    Backwards: Backwards
  };

}).call(this);
