import { getModel } from './index.ts'
import type { Collection, Document } from 'mongodb'

/** Small repository adapter preserves the inspected business services while every
 * read/write runs through a Mongoose model and writes enforce schema validation. */
export function modelRepository<T extends Document = Document>(name: string): Collection<T> {
  const model = getModel(name)
  const repository = {
    find(filter = {}, options: any = {}) {
      const q = model.find(filter, options.projection).lean()
      const cursor = {
        sort(value: any) { q.sort(value); return cursor },
        skip(value: number) { q.skip(value); return cursor },
        limit(value: number) { q.limit(value); return cursor },
        project(value: any) { q.select(value); return cursor },
        toArray() { return q.exec() },
      }
      return cursor
    },
    findOne(filter = {}, options: any = {}) {
      const q = model.findOne(filter, options.projection).lean()
      // Auth hashes are only selected explicitly inside the private repository.
      if (name === 'auth_users') q.select('+password_hash')
      return q.exec()
    },
    countDocuments(filter = {}) { return model.countDocuments(filter).exec() },
    distinct(key: string, filter = {}) { return model.distinct(key, filter).exec() },
    async insertOne(row: any) {
      const doc = await model.create(row)
      Object.assign(row, doc.toObject())
      return { acknowledged: true, insertedId: doc._id }
    },
    async insertMany(rows: any[]) {
      const docs = await model.insertMany(rows, { ordered: true })
      return { acknowledged: true, insertedCount: docs.length, insertedIds: Object.fromEntries(docs.map((d,i) => [i,d._id])) }
    },
    updateOne(filter: any, update: any, options: any = {}) { return model.updateOne(filter, update, { ...options, runValidators: true }).exec() },
    updateMany(filter: any, update: any, options: any = {}) { return model.updateMany(filter, update, { ...options, runValidators: true }).exec() },
    async replaceOne(filter: any, row: any, options: any = {}) {
      await new model(row).validate()
      return model.replaceOne(filter, row, { ...options, runValidators: true }).exec()
    },
    deleteOne(filter: any) { return model.deleteOne(filter).exec() },
    deleteMany(filter: any) { return model.deleteMany(filter).exec() },
    findOneAndDelete(filter: any) { return model.findOneAndDelete(filter).lean().exec() },
    findOneAndUpdate(filter: any, update: any, options: any = {}) { return model.findOneAndUpdate(filter, update, { ...options, runValidators: true }).lean().exec() },
  }
  return repository as unknown as Collection<T>
}
