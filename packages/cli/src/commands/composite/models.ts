import { Command, type CommandFlags } from '../../command.js'
import { Args, Flags } from '@oclif/core'
import Table from 'cli-table3'
import { readEncodedComposite } from '@composedb/devtools-node'
import { Composite } from '@composedb/devtools'
import { EncodedCompositeDefinition } from '@composedb/types'

type CompositeModelInfo = {
  id: string
  name: string
  description: string
  alias?: string
}

export default class CompositeModels extends Command<
  CommandFlags,
  { compositePath: string | undefined }
> {
  static description = 'display the list of models included in a composite'

  static args = {
    compositePath: Args.string({
      required: false,
      description: 'A path to encoded composite definition',
    }),
  }

  static flags = {
    ...Command.flags,
    'id-only': Flags.boolean({
      description: `display only model streamIDs`,
      exclusive: ['table'],
    }),
    table: Flags.boolean({
      description: 'display results in a table',
      exclusive: ['id-only'],
    }),
  }

  async run(): Promise<void> {
    try {
      this.spinner.start(`Fetching composite's models...`)
      let composite: Composite | undefined = undefined
      if (this.stdin !== undefined) {
        const definition = JSON.parse(this.stdin) as EncodedCompositeDefinition
        composite = await Composite.fromJSON({ ceramic: this.ceramic, definition })
      } else if (this.args.compositePath !== undefined) {
        composite = await readEncodedComposite(this.ceramic, this.args.compositePath)
      } else {
        this.spinner.fail(
          'You need to pass a path to encoded composite either via an arg or through stdin'
        )
        return
      }
      this.spinner.succeed(`Fetching composite's models... Done!`)
      if (this.flags['id-only'] === true) {
        this.log(JSON.stringify(Object.keys(composite.toParams().definition.models)))
      } else if (this.flags.table === true) {
        const table = new Table({
          head: ['Name', 'ID', 'Alias', 'Description'],
          colWidths: [32, 65, 32, 100],
        })
        const internalDefinition = composite.toParams().definition
        Object.entries(internalDefinition.models).map(([modelStreamID, modelDefinition]) => {
          table.push([
            modelDefinition.name,
            modelStreamID,
            internalDefinition.aliases && internalDefinition.aliases[modelStreamID]
              ? internalDefinition.aliases[modelStreamID]
              : '(none)',
            modelDefinition.description || '',
          ])
        })
        // Logging to stdout, so that the table is laid out properly
        this.log(table.toString())
      } else {
        const result: Array<CompositeModelInfo> = []
        const internalDefinition = composite.toParams().definition
        Object.entries(internalDefinition.models).map(([modelStreamID, modelDefinition]) => {
          const modelInfo: CompositeModelInfo = {
            id: modelStreamID,
            name: modelDefinition.name,
            description: modelDefinition.description || '',
          }
          if (
            internalDefinition.aliases &&
            internalDefinition.aliases[modelStreamID] !== undefined
          ) {
            modelInfo.alias = internalDefinition.aliases[modelStreamID]
          }
          result.push(modelInfo)
        })
        // Logging the models to stdout, so that they can be piped using standard I/O or redirected to a file
        this.log(JSON.stringify(result))
      }
    } catch (e) {
      this.spinner.fail((e as Error).message)
    }
  }
}
