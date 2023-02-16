import React, {useState} from "react"
import Project from "./Project"

const Portfolio = (props) => {
    const [getSearchTerm, setSearchTerm] = useState("")
    return(
        <div className="row portfolio justify-content-center">
            <input class="rounded-pill bg-dark text-white border-0 fs-4" type="text" placeholder="Search..." onChange={(event) => setSearchTerm(event.target.value)}/>
            {props.projects.filter((project) => {
                const noSearchField = getSearchTerm === ""
                const titleMatch = project.project_title.toLowerCase().includes(getSearchTerm.toLowerCase())
                const descriptionMatch = project.description.toLowerCase().includes(getSearchTerm.toLowerCase())
                const anythingMatches = noSearchField || titleMatch || descriptionMatch
                return anythingMatches ? project : ""
            }).map((project, index) => (
                <Project key={index} data={project}/>
            ))}
        </div>
    )
}

export default Portfolio