{difference, times, uniq} = require 'underscore-plus'
TextBuffer = require '../src/text-buffer'

describe "Marker", ->
  [buffer, markerCreations, markersUpdatedCount] = []

  beforeEach ->
    buffer = new TextBuffer(text: "abcdefghijklmnopqrstuvwxyz")
    markerCreations = []
    buffer.onDidCreateMarker (marker) -> markerCreations.push(marker)
    markersUpdatedCount = 0
    buffer.onDidUpdateMarkers -> markersUpdatedCount++

  describe "creation", ->
    describe "TextBuffer::markRange(range, properties)", ->
      it "creates a marker for the given range with the given properties", ->
        marker = buffer.markRange([[0, 3], [0, 6]])
        expect(marker.getRange()).toEqual [[0, 3], [0, 6]]
        expect(marker.getHeadPosition()).toEqual [0, 6]
        expect(marker.getTailPosition()).toEqual [0, 3]
        expect(marker.isReversed()).toBe false
        expect(marker.hasTail()).toBe true
        expect(markerCreations).toEqual [marker]
        expect(markersUpdatedCount).toBe 1

      it "allows a reversed marker to be created", ->
        marker = buffer.markRange([[0, 3], [0, 6]], reversed: true)
        expect(marker.getRange()).toEqual [[0, 3], [0, 6]]
        expect(marker.getHeadPosition()).toEqual [0, 3]
        expect(marker.getTailPosition()).toEqual [0, 6]
        expect(marker.isReversed()).toBe true
        expect(marker.hasTail()).toBe true

      it "allows an invalidation strategy to be assigned", ->
        marker = buffer.markRange([[0, 3], [0, 6]], invalidate: 'inside')
        expect(marker.getInvalidationStrategy()).toBe 'inside'

      it "allows custom state to be assigned", ->
        marker = buffer.markRange([[0, 3], [0, 6]], foo: 1, bar: 2)
        expect(marker.getProperties()).toEqual {foo: 1, bar: 2}

      it "clips the range before creating a marker with it", ->
        marker = buffer.markRange([[-100, -100], [100, 100]])
        expect(marker.getRange()).toEqual [[0, 0], [0, 26]]

      it "throws an error if an invalid point is given", ->
        marker1 = buffer.markRange([[0, 1], [0, 2]])

        expect -> buffer.markRange([[0, NaN], [0, 2]])
          .toThrow "Invalid Point: (0, NaN)"
        expect -> buffer.markRange([[0, 1], [0, NaN]])
          .toThrow "Invalid Point: (0, NaN)"

        expect(buffer.findMarkers({})).toEqual [marker1]
        expect(buffer.getMarkers()).toEqual [marker1]

    describe "TextBuffer::markPosition(position, properties)", ->
      it "creates a tail-less marker at the given position", ->
        marker = buffer.markPosition([0, 6])
        expect(marker.getRange()).toEqual [[0, 6], [0, 6]]
        expect(marker.getHeadPosition()).toEqual [0, 6]
        expect(marker.getTailPosition()).toEqual [0, 6]
        expect(marker.isReversed()).toBe false
        expect(marker.hasTail()).toBe false
        expect(markerCreations).toEqual [marker]

      it "allows an invalidation strategy to be assigned", ->
        marker = buffer.markPosition([0, 3], invalidate: 'inside')
        expect(marker.getInvalidationStrategy()).toBe 'inside'

      it "allows custom state to be assigned", ->
        marker = buffer.markPosition([0, 3], foo: 1, bar: 2)
        expect(marker.getProperties()).toEqual {foo: 1, bar: 2}

      it "throws an error if an invalid point is given", ->
        marker1 = buffer.markPosition([0, 1])

        expect -> buffer.markPosition([0, NaN])
          .toThrow "Invalid Point: (0, NaN)"

        expect(buffer.findMarkers({})).toEqual [marker1]
        expect(buffer.getMarkers()).toEqual [marker1]

  describe "direct updates", ->
    [marker, changes] = []

    beforeEach ->
      marker = buffer.markRange([[0, 6], [0, 9]])
      changes = []
      markersUpdatedCount = 0
      marker.onDidChange (change) -> changes.push(change)

    describe "::setHeadPosition(position, state)", ->
      it "sets the head position of the marker, flipping its orientation if necessary", ->
        marker.setHeadPosition([0, 12])
        expect(marker.getRange()).toEqual [[0, 6], [0, 12]]
        expect(marker.isReversed()).toBe false
        expect(markersUpdatedCount).toBe 1
        expect(changes).toEqual [{
          oldHeadPosition: [0, 9], newHeadPosition: [0, 12]
          oldTailPosition: [0, 6], newTailPosition: [0, 6]
          hadTail: true, hasTail: true
          wasValid: true, isValid: true
          oldProperties: {}, newProperties: {}
          textChanged: false
        }]

        changes = []
        marker.setHeadPosition([0, 3])
        expect(markersUpdatedCount).toBe 2
        expect(marker.getRange()).toEqual [[0, 3], [0, 6]]
        expect(marker.isReversed()).toBe true
        expect(changes).toEqual [{
          oldHeadPosition: [0, 12], newHeadPosition: [0, 3]
          oldTailPosition: [0, 6], newTailPosition: [0, 6]
          hadTail: true, hasTail: true
          wasValid: true, isValid: true
          oldProperties: {}, newProperties: {}
          textChanged: false
        }]

        changes = []
        marker.setHeadPosition([0, 9])
        expect(markersUpdatedCount).toBe 3
        expect(marker.getRange()).toEqual [[0, 6], [0, 9]]
        expect(marker.isReversed()).toBe false
        expect(changes).toEqual [{
          oldHeadPosition: [0, 3], newHeadPosition: [0, 9]
          oldTailPosition: [0, 6], newTailPosition: [0, 6]
          hadTail: true, hasTail: true
          wasValid: true, isValid: true
          oldProperties: {}, newProperties: {}
          textChanged: false
        }]

      it "does not give the marker a tail if it doesn't have one already", ->
        marker.clearTail()
        expect(marker.hasTail()).toBe false
        marker.setHeadPosition([0, 15])
        expect(marker.hasTail()).toBe false
        expect(marker.getRange()).toEqual [[0, 15], [0, 15]]

      it "does not notify ::onDidChange observers and returns false if the position isn't actually changed", ->
        expect(marker.setHeadPosition(marker.getHeadPosition())).toBe false
        expect(markersUpdatedCount).toBe 0
        expect(changes.length).toBe 0

      it "allows new properties to be assigned to the state", ->
        marker.setHeadPosition([0, 12], foo: 1)
        expect(markersUpdatedCount).toBe 1
        expect(changes).toEqual [{
          oldHeadPosition: [0, 9], newHeadPosition: [0, 12]
          oldTailPosition: [0, 6], newTailPosition: [0, 6]
          hadTail: true, hasTail: true
          wasValid: true, isValid: true
          oldProperties: {}, newProperties: {foo: 1}
          textChanged: false
        }]

        changes = []
        marker.setHeadPosition([0, 12], bar: 2)
        expect(marker.getProperties()).toEqual {foo: 1, bar: 2}
        expect(markersUpdatedCount).toBe 2
        expect(changes).toEqual [{
          oldHeadPosition: [0, 12], newHeadPosition: [0, 12]
          oldTailPosition: [0, 6], newTailPosition: [0, 6]
          hadTail: true, hasTail: true
          wasValid: true, isValid: true
          oldProperties: {foo: 1}, newProperties: {foo: 1, bar: 2}
          textChanged: false
        }]

      it "clips the assigned position", ->
        marker.setHeadPosition([100, 100])
        expect(marker.getHeadPosition()).toEqual [0, 26]

    describe "::setTailPosition(position, state)", ->
      it "sets the head position of the marker, flipping its orientation if necessary", ->
        marker.setTailPosition([0, 3])
        expect(marker.getRange()).toEqual [[0, 3], [0, 9]]
        expect(marker.isReversed()).toBe false
        expect(changes).toEqual [{
          oldHeadPosition: [0, 9], newHeadPosition: [0, 9]
          oldTailPosition: [0, 6], newTailPosition: [0, 3]
          hadTail: true, hasTail: true
          wasValid: true, isValid: true
          oldProperties: {}, newProperties: {}
          textChanged: false
        }]

        changes = []
        marker.setTailPosition([0, 12])
        expect(marker.getRange()).toEqual [[0, 9], [0, 12]]
        expect(marker.isReversed()).toBe true
        expect(changes).toEqual [{
          oldHeadPosition: [0, 9], newHeadPosition: [0, 9]
          oldTailPosition: [0, 3], newTailPosition: [0, 12]
          hadTail: true, hasTail: true
          wasValid: true, isValid: true
          oldProperties: {}, newProperties: {}
          textChanged: false
        }]

        changes = []
        marker.setTailPosition([0, 6])
        expect(marker.getRange()).toEqual [[0, 6], [0, 9]]
        expect(marker.isReversed()).toBe false
        expect(changes).toEqual [{
          oldHeadPosition: [0, 9], newHeadPosition: [0, 9]
          oldTailPosition: [0, 12], newTailPosition: [0, 6]
          hadTail: true, hasTail: true
          wasValid: true, isValid: true
          oldProperties: {}, newProperties: {}
          textChanged: false
        }]

      it "plants the tail of the marker if it does not have a tail", ->
        marker.clearTail()
        expect(marker.hasTail()).toBe false
        marker.setTailPosition([0, 0])
        expect(marker.hasTail()).toBe true
        expect(marker.getRange()).toEqual [[0, 0], [0, 9]]

      it "does not notify ::onDidChange observers and returns false if the position isn't actually changed", ->
        expect(marker.setTailPosition(marker.getTailPosition())).toBe false
        expect(changes.length).toBe 0

      it "allows new properties to be assigned to the state", ->
        marker.setTailPosition([0, 3], foo: 1)
        expect(changes).toEqual [{
          oldHeadPosition: [0, 9], newHeadPosition: [0, 9]
          oldTailPosition: [0, 6], newTailPosition: [0, 3]
          hadTail: true, hasTail: true
          wasValid: true, isValid: true
          oldProperties: {}, newProperties: {foo: 1}
          textChanged: false
        }]

        changes = []
        marker.setTailPosition([0, 3], bar: 2)
        expect(marker.getProperties()).toEqual {foo: 1, bar: 2}
        expect(changes).toEqual [{
          oldHeadPosition: [0, 9], newHeadPosition: [0, 9]
          oldTailPosition: [0, 3], newTailPosition: [0, 3]
          hadTail: true, hasTail: true
          wasValid: true, isValid: true
          oldProperties: {foo: 1}, newProperties: {foo: 1, bar: 2}
          textChanged: false
        }]

      it "clips the assigned position", ->
        marker.setTailPosition([100, 100])
        expect(marker.getTailPosition()).toEqual [0, 26]

    describe "::setRange(range, options)", ->
      it "sets the head and tail position simultaneously, flipping the orientation if the 'isReversed' option is true", ->
        marker.setRange([[0, 8], [0, 12]])
        expect(marker.getRange()).toEqual [[0, 8], [0, 12]]
        expect(marker.isReversed()).toBe false
        expect(marker.getHeadPosition()).toEqual [0, 12]
        expect(marker.getTailPosition()).toEqual [0, 8]
        expect(changes).toEqual [{
          oldHeadPosition: [0, 9], newHeadPosition: [0, 12]
          oldTailPosition: [0, 6], newTailPosition: [0, 8]
          hadTail: true, hasTail: true
          wasValid: true, isValid: true
          oldProperties: {}, newProperties: {}
          textChanged: false
        }]

        changes = []
        marker.setRange([[0, 3], [0, 9]], reversed: true)
        expect(marker.getRange()).toEqual [[0, 3], [0, 9]]
        expect(marker.isReversed()).toBe true
        expect(marker.getHeadPosition()).toEqual [0, 3]
        expect(marker.getTailPosition()).toEqual [0, 9]
        expect(changes).toEqual [{
          oldHeadPosition: [0, 12], newHeadPosition: [0, 3]
          oldTailPosition: [0, 8], newTailPosition: [0, 9]
          hadTail: true, hasTail: true
          wasValid: true, isValid: true
          oldProperties: {}, newProperties: {}
          textChanged: false
        }]

      it "plants the tail of the marker if it does not have a tail", ->
        marker.clearTail()
        expect(marker.hasTail()).toBe false
        marker.setRange([[0, 1], [0, 10]])
        expect(marker.hasTail()).toBe true
        expect(marker.getRange()).toEqual [[0, 1], [0, 10]]

      it "allows new properties to be assigned to the state", ->
        marker.setRange([[0, 1], [0, 2]], foo: 1)
        expect(changes).toEqual [{
          oldHeadPosition: [0, 9], newHeadPosition: [0, 2]
          oldTailPosition: [0, 6], newTailPosition: [0, 1]
          hadTail: true, hasTail: true
          wasValid: true, isValid: true
          oldProperties: {}, newProperties: {foo: 1}
          textChanged: false
        }]

        changes = []
        marker.setRange([[0, 3], [0, 6]], bar: 2)
        expect(marker.getProperties()).toEqual {foo: 1, bar: 2}
        expect(changes).toEqual [{
          oldHeadPosition: [0, 2], newHeadPosition: [0, 6]
          oldTailPosition: [0, 1], newTailPosition: [0, 3]
          hadTail: true, hasTail: true
          wasValid: true, isValid: true
          oldProperties: {foo: 1}, newProperties: {foo: 1, bar: 2}
          textChanged: false
        }]

      it "clips the assigned range", ->
        marker.setRange([[-100, -100], [100, 100]])
        expect(marker.getRange()).toEqual [[0, 0], [0, 26]]

      it "emits the right events when called inside of an ::onDidChange handler", ->
        marker.onDidChange (change) ->
          if marker.getHeadPosition().isEqual([0, 5])
            marker.setHeadPosition([0, 6])

        marker.setHeadPosition([0, 5])

        headPositions = for {oldHeadPosition, newHeadPosition} in changes
          {old: oldHeadPosition, new: newHeadPosition}

        expect(headPositions).toEqual [
          {old: [0, 9], new: [0, 5]}
          {old: [0, 5], new: [0, 6]}
        ]

      it "throws an error if an invalid range is given", ->
        expect -> marker.setRange([[0, NaN], [0, 12]])
          .toThrow "Invalid Point: (0, NaN)"

        expect(buffer.findMarkers({})).toEqual [marker]
        expect(marker.getRange()).toEqual [[0, 6], [0, 9]]

    describe "::clearTail() / ::plantTail()", ->
      it "clears the tail / plants the tail at the current head position", ->
        marker.setRange([[0, 6], [0, 9]], reversed: true)

        changes = []
        marker.clearTail()
        expect(marker.getRange()).toEqual [[0, 6], [0, 6]]
        expect(marker.hasTail()).toBe false
        expect(marker.isReversed()).toBe false

        expect(changes).toEqual [{
          oldHeadPosition: [0, 6], newHeadPosition: [0, 6]
          oldTailPosition: [0, 9], newTailPosition: [0, 6]
          hadTail: true, hasTail: false
          wasValid: true, isValid: true
          oldProperties: {}, newProperties: {}
          textChanged: false
        }]

        changes = []
        marker.setHeadPosition([0, 12])
        expect(marker.getRange()).toEqual [[0, 12], [0, 12]]
        expect(changes).toEqual [{
          oldHeadPosition: [0, 6], newHeadPosition: [0, 12]
          oldTailPosition: [0, 6], newTailPosition: [0, 12]
          hadTail: false, hasTail: false
          wasValid: true, isValid: true
          oldProperties: {}, newProperties: {}
          textChanged: false
        }]

        changes = []
        marker.plantTail()
        expect(marker.hasTail()).toBe true
        expect(marker.isReversed()).toBe false
        expect(marker.getRange()).toEqual [[0, 12], [0, 12]]
        expect(changes).toEqual [{
          oldHeadPosition: [0, 12], newHeadPosition: [0, 12]
          oldTailPosition: [0, 12], newTailPosition: [0, 12]
          hadTail: false, hasTail: true
          wasValid: true, isValid: true
          oldProperties: {}, newProperties: {}
          textChanged: false
        }]

        changes = []
        marker.setHeadPosition([0, 15])
        expect(marker.getRange()).toEqual [[0, 12], [0, 15]]
        expect(changes).toEqual [{
          oldHeadPosition: [0, 12], newHeadPosition: [0, 15]
          oldTailPosition: [0, 12], newTailPosition: [0, 12]
          hadTail: true, hasTail: true
          wasValid: true, isValid: true
          oldProperties: {}, newProperties: {}
          textChanged: false
        }]

        changes = []
        marker.plantTail()
        expect(marker.getRange()).toEqual [[0, 12], [0, 15]]
        expect(changes).toEqual []

    describe "::setProperties(properties)", ->
      it "merges the given properties into the current properties", ->
        marker.setProperties(foo: 1)
        expect(marker.getProperties()).toEqual {foo: 1}
        marker.setProperties(bar: 2)
        expect(marker.getProperties()).toEqual {foo: 1, bar: 2}
        expect(markersUpdatedCount).toBe 2

  describe "indirect updates (due to buffer changes)", ->
    [allStrategies, neverMarker, surroundMarker, overlapMarker, insideMarker, touchMarker] = []

    beforeEach ->
      overlapMarker = buffer.markRange([[0, 6], [0, 9]], invalidate: 'overlap')
      neverMarker = overlapMarker.copy(invalidate: 'never')
      surroundMarker = overlapMarker.copy(invalidate: 'surround')
      insideMarker = overlapMarker.copy(invalidate: 'inside')
      touchMarker = overlapMarker.copy(invalidate: 'touch')
      allStrategies = [neverMarker, surroundMarker, overlapMarker, insideMarker, touchMarker]
      markersUpdatedCount = 0

    it "defers notifying Marker::onDidChange observers until after notifying Buffer::onDidChange observers", ->
      for marker in allStrategies
        do (marker) ->
          marker.changes = []
          marker.onDidChange (change) ->
            marker.changes.push(change)

      changedCount = 0
      changeSubscription =
        buffer.onDidChange (change) ->
          changedCount++
          expect(markersUpdatedCount).toBe 0
          for marker in allStrategies
            expect(marker.getRange()).toEqual [[0, 8], [0, 11]]
            expect(marker.isValid()).toBe true
            expect(marker.changes.length).toBe 0

      buffer.setTextInRange([[0, 1], [0, 2]], "ABC")

      expect(changedCount).toBe 1

      for marker in allStrategies
        expect(marker.changes).toEqual [{
          oldHeadPosition: [0, 9], newHeadPosition: [0, 11]
          oldTailPosition: [0, 6], newTailPosition: [0, 8]
          hadTail: true, hasTail: true
          wasValid: true, isValid: true
          oldProperties: {}, newProperties: {}
          textChanged: true
        }]
      expect(markersUpdatedCount).toBe 1

      marker.changes = [] for marker in allStrategies
      changeSubscription.dispose()
      changedCount = 0
      markersUpdatedCount = 0
      buffer.onDidChange (change) ->
        changedCount++
        expect(markersUpdatedCount).toBe 0
        for marker in allStrategies
          expect(marker.getRange()).toEqual [[0, 6], [0, 9]]
          expect(marker.isValid()).toBe true
          expect(marker.changes.length).toBe 0

    it "notifies ::onDidUpdateMarkers observers even if there are no Marker::onDidChange observers", ->
      expect(markersUpdatedCount).toBe 0
      buffer.insert([0, 0], "123")
      expect(markersUpdatedCount).toBe 1
      overlapMarker.setRange([[0, 1], [0, 2]])
      expect(markersUpdatedCount).toBe 2

    it "emits onDidChange events when undoing/redoing text changes that move the marker", ->
      marker = buffer.markRange([[0, 4], [0, 8]])
      buffer.insert([0, 0], 'ABCD')

      changes = []
      marker.onDidChange (change) -> changes.push(change)
      buffer.undo()
      expect(changes.length).toBe 1
      expect(changes[0].newHeadPosition).toEqual [0, 8]
      buffer.redo()
      expect(changes.length).toBe 2
      expect(changes[1].newHeadPosition).toEqual [0, 12]

    describe "when a change precedes a marker", ->
      it "shifts the marker based on the characters inserted or removed by the change", ->
        buffer.setTextInRange([[0, 1], [0, 2]], "ABC")
        for marker in allStrategies
          expect(marker.getRange()).toEqual [[0, 8], [0, 11]]
          expect(marker.isValid()).toBe true

        buffer.setTextInRange([[0, 1], [0, 1]], '\nDEF')
        for marker in allStrategies
          expect(marker.getRange()).toEqual [[1, 10], [1, 13]]
          expect(marker.isValid()).toBe true

    describe "when a change follows a marker", ->
      it "does not shift the marker", ->
        buffer.setTextInRange([[0, 10], [0, 12]], "ABC")
        for marker in allStrategies
          expect(marker.getRange()).toEqual [[0, 6], [0, 9]]
          expect(marker.isValid()).toBe true

    describe "when a change starts at a marker's start position", ->
      describe "when the marker has a tail", ->
        it "interprets the change as being inside the marker for all invalidation strategies", ->
          buffer.setTextInRange([[0, 6], [0, 7]], "ABC")

          for marker in difference(allStrategies, [insideMarker, touchMarker])
            expect(marker.getRange()).toEqual [[0, 6], [0, 11]]
            expect(marker.isValid()).toBe true

          for marker in [insideMarker, touchMarker]
            expect(marker.getRange()).toEqual [[0, 6], [0, 11]]
            expect(marker.isValid()).toBe false

      describe "when the marker has no tail", ->
        it "interprets the change as being outside the marker for all invalidation strategies", ->
          for marker in allStrategies
            marker.setRange([[0, 6], [0, 11]], reversed: true)
            marker.clearTail()
            expect(marker.getRange()).toEqual [[0, 6], [0, 6]]

          buffer.setTextInRange([[0, 6], [0, 6]], "ABC")

          for marker in difference(allStrategies, [touchMarker])
            expect(marker.getRange()).toEqual [[0, 9], [0, 9]]
            expect(marker.isValid()).toBe true

          expect(touchMarker.getRange()).toEqual [[0, 9], [0, 9]]
          expect(touchMarker.isValid()).toBe false

          buffer.setTextInRange([[0, 9], [0, 9]], "DEF")

          for marker in difference(allStrategies, [touchMarker])
            expect(marker.getRange()).toEqual [[0, 12], [0, 12]]
            expect(marker.isValid()).toBe true

          expect(touchMarker.getRange()).toEqual [[0, 12], [0, 12]]
          expect(touchMarker.isValid()).toBe false

    describe "when a change ends at a marker's start position but starts before it", ->
      it "interprets the change as being outside the marker for all invalidation strategies", ->
        buffer.setTextInRange([[0, 4], [0, 6]], "ABC")

        for marker in difference(allStrategies, [touchMarker])
          expect(marker.getRange()).toEqual [[0, 7], [0, 10]]
          expect(marker.isValid()).toBe true

        expect(touchMarker.getRange()).toEqual [[0, 7], [0, 10]]
        expect(touchMarker.isValid()).toBe false

    describe "when a change starts and ends at a marker's start position", ->
      it "interprets the change as being inside the marker for all invalidation strategies except 'inside'", ->
        buffer.insert([0, 6], "ABC")

        for marker in difference(allStrategies, [insideMarker, touchMarker])
          expect(marker.getRange()).toEqual [[0, 6], [0, 12]]
          expect(marker.isValid()).toBe true

        expect(insideMarker.getRange()).toEqual [[0, 9], [0, 12]]
        expect(insideMarker.isValid()).toBe true

        expect(touchMarker.getRange()).toEqual [[0, 6], [0, 12]]
        expect(touchMarker.isValid()).toBe false

    describe "when a change starts at a marker's end position", ->
      describe "when the change is an insertion", ->
        it "interprets the change as being inside the marker for all invalidation strategies except 'inside'", ->
          buffer.setTextInRange([[0, 9], [0, 9]], "ABC")

          for marker in difference(allStrategies, [insideMarker, touchMarker])
            expect(marker.getRange()).toEqual [[0, 6], [0, 12]]
            expect(marker.isValid()).toBe true

          expect(insideMarker.getRange()).toEqual [[0, 6], [0, 9]]
          expect(insideMarker.isValid()).toBe true

          expect(touchMarker.getRange()).toEqual [[0, 6], [0, 12]]
          expect(touchMarker.isValid()).toBe false

      describe "when the change replaces some existing text", ->
        it "interprets the change as being outside the marker for all invalidation strategies", ->
          buffer.setTextInRange([[0, 9], [0, 11]], "ABC")

          for marker in difference(allStrategies, [touchMarker])
            expect(marker.getRange()).toEqual [[0, 6], [0, 9]]
            expect(marker.isValid()).toBe true

          expect(touchMarker.getRange()).toEqual [[0, 6], [0, 9]]
          expect(touchMarker.isValid()).toBe false

    describe "when a change surrounds a marker", ->
      it "truncates the marker to the end of the change and invalidates every invalidation strategy except 'never'", ->
        buffer.setTextInRange([[0, 5], [0, 10]], "ABC")

        for marker in allStrategies
          expect(marker.getRange()).toEqual [[0, 8], [0, 8]]

        for marker in difference(allStrategies, [neverMarker])
          expect(marker.isValid()).toBe false

        expect(neverMarker.isValid()).toBe true

    describe "when a change is inside a marker", ->
      it "adjusts the marker's end position and invalidates markers with an 'inside' or 'touch' strategy", ->
        buffer.setTextInRange([[0, 7], [0, 8]], "AB")

        for marker in allStrategies
          expect(marker.getRange()).toEqual [[0, 6], [0, 10]]

        for marker in difference(allStrategies, [insideMarker, touchMarker])
          expect(marker.isValid()).toBe true

        expect(insideMarker.isValid()).toBe false
        expect(touchMarker.isValid()).toBe false

    describe "when a change overlaps the start of a marker", ->
      it "moves the start of the marker to the end of the change and invalidates the marker if its stategy is 'overlap', 'inside', or 'touch'", ->
        buffer.setTextInRange([[0, 5], [0, 7]], "ABC")

        for marker in allStrategies
          expect(marker.getRange()).toEqual [[0, 8], [0, 10]]

        expect(neverMarker.isValid()).toBe true
        expect(surroundMarker.isValid()).toBe true
        expect(overlapMarker.isValid()).toBe false
        expect(insideMarker.isValid()).toBe false
        expect(touchMarker.isValid()).toBe false

    describe "when a change overlaps the end of a marker", ->
      it "moves the end of the marker to the end of the change and invalidates the marker if its stategy is 'overlap', 'inside', or 'touch'", ->
        buffer.setTextInRange([[0, 8], [0, 10]], "ABC")

        for marker in allStrategies
          expect(marker.getRange()).toEqual [[0, 6], [0, 11]]

        expect(neverMarker.isValid()).toBe true
        expect(surroundMarker.isValid()).toBe true
        expect(overlapMarker.isValid()).toBe false
        expect(insideMarker.isValid()).toBe false
        expect(touchMarker.isValid()).toBe false

    describe "when multiple changes occur in a transaction", ->
      it "emits one change event for each marker that was indirectly updated", ->
        for marker in allStrategies
          do (marker) ->
            marker.changes = []
            marker.onDidChange (change) ->
              marker.changes.push(change)

        buffer.transact ->
          buffer.insert([0, 7], ".")
          buffer.append("!")

          for marker in allStrategies
            expect(marker.changes.length).toBe 0

          neverMarker.setRange([[0, 0], [0, 1]])

        expect(neverMarker.changes).toEqual [{
          oldHeadPosition: [0, 9]
          newHeadPosition: [0, 1]
          oldTailPosition: [0, 6]
          newTailPosition: [0, 0]
          wasValid: true
          isValid: true
          hadTail: true
          hasTail: true
          oldProperties: {}
          newProperties: {}
          textChanged: false
        }]

        expect(insideMarker.changes).toEqual [{
          oldHeadPosition: [0, 9]
          newHeadPosition: [0, 10]
          oldTailPosition: [0, 6]
          newTailPosition: [0, 6]
          wasValid: true
          isValid: false
          hadTail: true
          hasTail: true
          oldProperties: {}
          newProperties: {}
          textChanged: true
        }]

  describe "destruction", ->
    it "removes the marker from the buffer, marks it destroyed and invalid, and notifies ::onDidDestroy observers", ->
      marker = buffer.markRange([[0, 3], [0, 6]])
      expect(buffer.getMarker(marker.id)).toBe marker
      marker.onDidDestroy destroyedHandler = jasmine.createSpy("destroyedHandler")

      marker.destroy()

      expect(destroyedHandler.callCount).toBe 1
      expect(buffer.getMarker(marker.id)).toBeUndefined()
      expect(marker.isDestroyed()).toBe true
      expect(marker.isValid()).toBe false

    it "handles markers deleted in event handlers", ->
      marker1 = buffer.markRange([[0, 3], [0, 6]])
      marker2 = marker1.copy()
      marker3 = marker1.copy()

      marker1.onDidChange ->
        marker1.destroy()
        marker2.destroy()
        marker3.destroy()

      # doesn't blow up.
      buffer.insert([0, 0], "!")

      marker1 = buffer.markRange([[0, 3], [0, 6]])
      marker2 = marker1.copy()
      marker3 = marker1.copy()

      marker1.onDidChange ->
        marker1.destroy()
        marker2.destroy()
        marker3.destroy()

      # doesn't blow up.
      buffer.undo()

    it "allows the position to be retrieved after destruction", ->
      marker = buffer.markRange([[0, 3], [0, 6]])
      marker.destroy()
      expect(marker.getRange()).toEqual [[0, 3], [0, 6]]
      expect(marker.getHeadPosition()).toEqual [0, 6]
      expect(marker.getTailPosition()).toEqual [0, 3]
      expect(marker.getStartPosition()).toEqual [0, 3]
      expect(marker.getEndPosition()).toEqual [0, 6]

    it "does not reinsert the marker if its range is later updated", ->
      marker = buffer.markRange([[0, 3], [0, 6]])
      marker.destroy()
      expect(buffer.findMarkers(intersectsRow: 0)).toEqual []
      marker.setRange([[0, 0], [0, 9]])
      expect(buffer.findMarkers(intersectsRow: 0)).toEqual []

    it "does not blow up when destroy is called twice", ->
      marker = buffer.markRange([[0, 3], [0, 6]])
      marker.destroy()
      marker.destroy()

  describe "TextBuffer::findMarkers(properties)", ->
    [marker1, marker2, marker3, marker4] = []

    beforeEach ->
      marker1 = buffer.markRange([[0, 0], [0, 3]], class: 'a')
      marker2 = buffer.markRange([[0, 0], [0, 5]], class: 'a', invalidate: 'surround')
      marker3 = buffer.markRange([[0, 4], [0, 7]], class: 'a')
      marker4 = buffer.markRange([[0, 0], [0, 7]], class: 'b', invalidate: 'never')

    it "can find markers based on custom properties", ->
      expect(buffer.findMarkers(class: 'a')).toEqual [marker2, marker1, marker3]
      expect(buffer.findMarkers(class: 'b')).toEqual [marker4]

    it "can find markers based on their invalidation strategy", ->
      expect(buffer.findMarkers(invalidate: 'overlap')).toEqual [marker1, marker3]
      expect(buffer.findMarkers(invalidate: 'surround')).toEqual [marker2]
      expect(buffer.findMarkers(invalidate: 'never')).toEqual [marker4]

    it "can find markers that start or end at a given position", ->
      expect(buffer.findMarkers(startPosition: [0, 0])).toEqual [marker4, marker2, marker1]
      expect(buffer.findMarkers(startPosition: [0, 0], class: 'a')).toEqual [marker2, marker1]
      expect(buffer.findMarkers(startPosition: [0, 0], endPosition: [0, 3], class: 'a')).toEqual [marker1]
      expect(buffer.findMarkers(startPosition: [0, 4], endPosition: [0, 7])).toEqual [marker3]
      expect(buffer.findMarkers(endPosition: [0, 7])).toEqual [marker4, marker3]
      expect(buffer.findMarkers(endPosition: [0, 7], class: 'b')).toEqual [marker4]

    it "can find markers that contain a given point", ->
      expect(buffer.findMarkers(containsPosition: [0, 0])).toEqual [marker4, marker2, marker1]
      expect(buffer.findMarkers(containsPoint: [0, 0])).toEqual [marker4, marker2, marker1]
      expect(buffer.findMarkers(containsPoint: [0, 1], class: 'a')).toEqual [marker2, marker1]
      expect(buffer.findMarkers(containsPoint: [0, 4])).toEqual [marker4, marker2, marker3]

    it "can find markers that contain a given range", ->
      expect(buffer.findMarkers(containsRange: [[0, 1], [0, 4]])).toEqual [marker4, marker2]
      expect(buffer.findMarkers(containsRange: [[0, 4], [0, 1]])).toEqual [marker4, marker2]
      expect(buffer.findMarkers(containsRange: [[0, 1], [0, 3]])).toEqual [marker4, marker2, marker1]
      expect(buffer.findMarkers(containsRange: [[0, 6], [0, 7]])).toEqual [marker4, marker3]

    it "can find markers that intersect a given range", ->
      expect(buffer.findMarkers(intersectsRange: [[0, 4], [0, 6]])).toEqual [marker4, marker2, marker3]
      expect(buffer.findMarkers(intersectsRange: [[0, 0], [0, 2]])).toEqual [marker4, marker2, marker1]

    it "can find markers that start or end at a given row", ->
      buffer.setTextInRange([[0, 7], [0, 7]], '\n')
      buffer.setTextInRange([[0, 3], [0, 4]], ' \n')
      expect(buffer.findMarkers(startRow: 0)).toEqual [marker4, marker2, marker1]
      expect(buffer.findMarkers(startRow: 1)).toEqual [marker3]
      expect(buffer.findMarkers(endRow: 2)).toEqual [marker4, marker3]
      expect(buffer.findMarkers(startRow: 0, endRow: 2)).toEqual [marker4]

    it "can find markers that intersect a given row", ->
      buffer.setTextInRange([[0, 7], [0, 7]], '\n')
      buffer.setTextInRange([[0, 3], [0, 4]], ' \n')
      expect(buffer.findMarkers(intersectsRow: 0)).toEqual [marker4, marker2, marker1]
      expect(buffer.findMarkers(intersectsRow: 1)).toEqual [marker4, marker2, marker3]

    it "can find markers that intersect a given range", ->
      buffer.setTextInRange([[0, 7], [0, 7]], '\n')
      buffer.setTextInRange([[0, 3], [0, 4]], ' \n')
      expect(buffer.findMarkers(intersectsRowRange: [1, 2])).toEqual [marker4, marker2, marker3]

    it "can find markers that are contained within a certain range, inclusive", ->
      expect(buffer.findMarkers(containedInRange: [[0, 0], [0, 6]])).toEqual [marker2, marker1]
      expect(buffer.findMarkers(containedInRange: [[0, 4], [0, 7]])).toEqual [marker3]

  describe "MarkerLayer", ->
    [layer1, layer2] = []

    beforeEach ->
      layer1 = buffer.addMarkerLayer()
      layer2 = buffer.addMarkerLayer()

    it "ensures that marker ids are unique across layers", ->
      times 5, ->
        buffer.markRange([[0, 3], [0, 6]])
        layer1.markRange([[0, 4], [0, 7]])
        layer2.markRange([[0, 5], [0, 8]])

      ids = buffer.getMarkers()
        .concat(layer1.getMarkers())
        .concat(layer2.getMarkers())
        .map (marker) -> marker.id

      expect(uniq(ids).length).toEqual ids.length

    it "updates each layer's markers when the text changes", ->
      defaultMarker = buffer.markRange([[0, 3], [0, 6]])
      layer1Marker = layer1.markRange([[0, 4], [0, 7]])
      layer2Marker = layer2.markRange([[0, 5], [0, 8]])

      buffer.setTextInRange([[0, 1], [0, 2]], "BBB")
      expect(defaultMarker.getRange()).toEqual [[0, 5], [0, 8]]
      expect(layer1Marker.getRange()).toEqual [[0, 6], [0, 9]]
      expect(layer2Marker.getRange()).toEqual [[0, 7], [0, 10]]

      layer2.destroy()
      expect(layer2.isAlive()).toBe false
      expect(layer2.isDestroyed()).toBe true

      expect(layer1.isAlive()).toBe true
      expect(layer1.isDestroyed()).toBe false

      buffer.undo()
      expect(defaultMarker.getRange()).toEqual [[0, 3], [0, 6]]
      expect(layer1Marker.getRange()).toEqual [[0, 4], [0, 7]]
      expect(layer2Marker.getRange()).toEqual [[0, 7], [0, 10]]

    it "emits onDidCreateMarker events synchronously when markers are created", ->
      createdMarkers = []
      layer1.onDidCreateMarker (marker) -> createdMarkers.push(marker)
      marker = layer1.markRange([[0, 1], [2, 3]])
      expect(createdMarkers).toEqual [marker]

    it "does not emit marker events on the TextBuffer for non-default layers", ->
      createEventCount = updateEventCount = 0
      buffer.onDidCreateMarker -> createEventCount++
      buffer.onDidUpdateMarkers -> updateEventCount++

      marker1 = buffer.markRange([[0, 1], [0, 2]])
      marker1.setRange([[0, 1], [0, 3]])

      expect(createEventCount).toBe 1
      expect(updateEventCount).toBe 2

      marker2 = layer1.markRange([[0, 1], [0, 2]])
      marker2.setRange([[0, 1], [0, 3]])

      expect(createEventCount).toBe 1
      expect(updateEventCount).toBe 2

    describe "when maintainHistory is enabled for the layer", ->
      layer3 = null

      beforeEach ->
        layer3 = buffer.addMarkerLayer(maintainHistory: true)

      it "restores the state of all markers in the layer on undo and redo", ->
        buffer.setText('')
        buffer.transact -> buffer.append('foo')
        layer3 = buffer.addMarkerLayer(maintainHistory: true)

        marker1 = layer3.markRange([[0, 0], [0, 0]], a: 'b', invalidate: 'never')
        marker2 = layer3.markRange([[0, 0], [0, 0]], c: 'd', invalidate: 'never')

        buffer.transact ->
          buffer.append('\n')
          buffer.append('bar')

          marker1.destroy()
          marker2.setRange([[0, 2], [0, 3]])
          marker3 = layer3.markRange([[0, 0], [0, 3]], e: 'f', invalidate: 'never')
          marker4 = layer3.markRange([[1, 0], [1, 3]], g: 'h', invalidate: 'never')

        buffer.undo()

        expect(buffer.getText()).toBe 'foo'
        markers = layer3.findMarkers({})
        expect(markers.length).toBe 2
        expect(markers[0].getProperties()).toEqual {c: 'd'}
        expect(markers[0].getRange()).toEqual [[0, 0], [0, 0]]
        expect(markers[1].getProperties()).toEqual {a: 'b'}
        expect(markers[1].getRange()).toEqual [[0, 0], [0, 0]]

        buffer.redo()

        expect(buffer.getText()).toBe 'foo\nbar'
        markers = layer3.findMarkers({})
        expect(markers.length).toBe 3
        expect(markers[0].getProperties()).toEqual {e: 'f'}
        expect(markers[0].getRange()).toEqual [[0, 0], [0, 3]]
        expect(markers[1].getProperties()).toEqual {c: 'd'}
        expect(markers[1].getRange()).toEqual [[0, 2], [0, 3]]
        expect(markers[2].getProperties()).toEqual {g: 'h'}
        expect(markers[2].getRange()).toEqual [[1, 0], [1, 3]]

      it "does not undo marker manipulations that aren't associated with text changes", ->
        marker = layer3.markRange([[0, 6], [0, 9]])

        # Can't undo changes in a transaction without other buffer changes
        buffer.transact -> marker.setRange([[0, 4], [0, 20]])
        buffer.undo()
        expect(marker.getRange()).toEqual [[0, 4], [0, 20]]

        # Can undo changes in a transaction with other buffer changes
        buffer.transact ->
          marker.setRange([[0, 5], [0, 9]])
          buffer.setTextInRange([[0, 2], [0, 3]], 'XYZ')
          marker.setRange([[0, 8], [0, 12]])

        buffer.undo()
        expect(marker.getRange()).toEqual [[0, 4], [0, 20]]

        buffer.redo()
        expect(marker.getRange()).toEqual [[0, 8], [0, 12]]

      it "ignores snapshot references to marker layers that no longer exist", ->
        layer3.markRange([[0, 6], [0, 9]])
        buffer.append("stuff")
        layer3.destroy()

        # Should not throw an exception
        buffer.undo()

    describe "::findMarkers(params)", ->
      it "does not find markers from other layers", ->
        defaultMarker = buffer.markRange([[0, 3], [0, 6]])
        layer1Marker = layer1.markRange([[0, 3], [0, 6]])
        layer2Marker = layer2.markRange([[0, 3], [0, 6]])

        expect(buffer.findMarkers(containsPoint: [0, 4])).toEqual [defaultMarker]
        expect(layer1.findMarkers(containsPoint: [0, 4])).toEqual [layer1Marker]
        expect(layer2.findMarkers(containsPoint: [0, 4])).toEqual [layer2Marker]

    describe "::onDidUpdate", ->
      it "notifies observers asynchronously when markers are created, updated, or destroyed", ->
        updateCount = 0
        layer1.onDidUpdate -> updateCount++

        marker1 = layer1.markRange([[0, 2], [0, 4]])
        marker2 = layer1.markRange([[0, 6], [0, 8]])

        waitsFor -> updateCount is 1

        runs ->
          marker1.setRange([[1, 2], [3, 4]])
          marker2.setRange([[4, 5], [6, 7]])

        waitsFor -> updateCount is 2

        runs ->
          buffer.insert([0, 1], "xxx")
          buffer.insert([0, 1], "yyy")

        waitsFor -> updateCount is 3

        runs ->
          marker1.destroy()
          marker2.destroy()

        waitsFor -> updateCount is 4

    describe "::copy", ->
      it "creates a new marker layer with markers in the same states", ->
        originalLayer = buffer.addMarkerLayer(maintainHistory: true)
        originalLayer.markRange([[0, 1], [0, 3]], a: 'b')
        originalLayer.markPosition([0, 2], c: 'd')

        copy = originalLayer.copy()
        expect(copy).not.toBe originalLayer

        markers = copy.getMarkers()
        expect(markers.length).toBe 2
        expect(markers[0].getRange()).toEqual [[0, 1], [0, 3]]
        expect(markers[0].getProperties()).toEqual {a: 'b'}
        expect(markers[1].getRange()).toEqual [[0, 2], [0, 2]]
        expect(markers[1].getProperties()).toEqual {c: 'd'}
        expect(markers[1].hasTail()).toBe false
