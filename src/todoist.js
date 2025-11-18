import { TodoistApi } from '@doist/todoist-api-typescript'

const api = new TodoistApi('00cb5e47e65847606ed7e22ad11298ea2918d70b')

api.getTasks().then((tasks) => console.log(tasks)).catch((error) => console.log(error))

// api.getTask('6X4Vw2Hfmg73Q2XR')
//     .then((task) => console.log(task))
//     .catch((error) => console.log(error))