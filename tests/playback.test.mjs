import test from 'node:test'
import assert from 'node:assert/strict'
import { upcomingTracks } from '../src/playback.mjs'

const queue = ['one', 'two', 'three', 'four'].map(id => ({ id }))

test('the queue stops at the last track unless repeat all is on', () => {
  assert.deepEqual(upcomingTracks(queue, 'two'), queue.slice(2))
  assert.deepEqual(upcomingTracks(queue, 'four'), [])
  assert.deepEqual(upcomingTracks(queue, 'four', true), queue.slice(0, 3))
  assert.deepEqual(upcomingTracks([queue[0]], 'one', true), [])
})
