import React, {useState} from "react"
import Project from "./Project"

const Portfolio = (props) => {
    const [getSearchTerm, setSearchTerm] = useState("")
    return(
        <div className="row portfolio justify-content-center">
            <input class="rounded-pill bg-dark text-white border-0 fs-4" type="text" placeholder="Search..." onChange={(event) => setSearchTerm(event.target.value)}/>
            {props.projects.filter((project) => {

                // If no search query defined, it has to display all elements.
                const noSearchQuery = getSearchTerm === ""

                // Stores all data that can be searched in a single place
                var searchableData = project.project_title
                    + project.description
                    + project.highlighted_technologies.join()
                    + project.other_technologies.join()

                const foundSearchQuery = searchableData.toLowerCase().includes(getSearchTerm.toLowerCase())

                return noSearchQuery || foundSearchQuery ? project : ""
            }).map((project, index) => (
                <Project key={index} data={project}/>
            )).sort((a, b) => {
                return -a.props.data.start_date.localeCompare(b.props.data.start_date)
            })}
        </div>
    )
}

export default Portfolio