import { EventEmitter } from 'events';
import queue from 'fastq'

class Lock extends EventEmitter {
  locked: boolean;

  constructor () {
    super()

    this.locked = false
  }

  lock () {
    if (this.locked === true) return
    this.locked = true
    this.emit('locked')
  }

  unlock () {
    if (this.locked === false) return
    this.locked = false
    this.emit('unlocked')
  }
}

export function QueuedRepo (repo) {
  const copy = Object.create(repo)

  copy._locks = {}
  copy._queues = {}

  copy._ensureQueue = function (id) {
    if (!this._queues[id]) {
      const lock = this._locks[id] = new Lock()

      const doTask = async (id) => {
        lock.once('unlocked', () => {
          return;
        })
        lock.lock()
        return await this._get(id)

      } 
      
      this._queues[id] = queue.promise(this, doTask, 1)
      
    }
  }

  copy._commit = copy.commit
  copy._get = copy.get

  copy.get = async function (id) {
    this._ensureQueue(id)

    const fn = this._get.bind(this, id)

    return await this._queues[id].push(id).catch((err) => console.error(err))
  }

  copy.lock = function (entity) {
    this._ensureQueue(entity.id)
    this._locks[entity.id].lock()
  }

  copy.commit = async function (entity) {
    const self = this
    this._ensureQueue(entity.id)
    await this._commit(entity)
    self._locks[entity.id].unlock()
  }

  copy.unlock = function (entity) {
    this._ensureQueue(entity.id)
    this._locks[entity.id].unlock()
  }

  return copy
}
