import * as icons from "./components"
import type { App } from "vue"

export interface InstallOptions {
    prefix?: string
}

export default function install(
    app: App,
    { prefix = "" }: InstallOptions = {},
) {
    for (const [name, component] of Object.entries(icons)) {
        app.component(`${prefix}${name}`, component)
    }
}

export { icons }
export * from "./components"
