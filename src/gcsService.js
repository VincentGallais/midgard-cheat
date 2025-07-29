import { GCSClient } from 'midgard-commons/lib/gcs-client.js'

class GCSService {
  constructor(fastifyInstance, bucketName = '52-entertainment-goto-funbridge-games') {
    this.gcsClient = new GCSClient(fastifyInstance, bucketName)
    this.fastifyInstance = fastifyInstance
  }

  static create(fastifyInstance, bucketName) {
    return new GCSService(fastifyInstance, bucketName)
  }

  getClient() {
    return this.gcsClient
  }

  async listFiles(prefix) {
    try {
      const files = await this.gcsClient.listFiles(prefix)
      this.fastifyInstance.log.info(`Number of files found in ${prefix}: ${files.length}`)
      return files
    } catch (error) {
      this.fastifyInstance.log.error(`Error listing files in ${prefix}:`, error)
      throw error
    }
  }

  async downloadAndReadFile(fileName) {
    try {
      await this.gcsClient.downloadFile(fileName)
      const contentLines = await this.gcsClient.readFile(fileName)
      await this.gcsClient.removeFile(fileName)
      return contentLines
    } catch (error) {
      this.fastifyInstance.log.error(`Error reading file ${fileName}:`, error)
      throw error
    }
  }

  async processFilesInBatches(files, concurrency = 5) {
    const allData = []

    for (let i = 0; i < files.length; i += concurrency) {
      const batch = files.slice(i, i + concurrency)
      const batchPromises = batch.map((file) => this.downloadAndReadFile(file.name))

      try {
        const batchResults = await Promise.all(batchPromises)
        batchResults.forEach((lines) => allData.push(...lines))

        this.fastifyInstance.log.info(`Processed batch ${Math.floor(i / concurrency) + 1}/${Math.ceil(files.length / concurrency)}`)
      } catch (error) {
        this.fastifyInstance.log.error(`Error processing batch ${i}-${i + concurrency}:`, error)
        throw error
      }
    }
    return allData
  }
}

export { GCSService }
