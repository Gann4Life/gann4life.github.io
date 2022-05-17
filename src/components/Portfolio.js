import React from "react"
import Project from "./Project"

const Portfolio = (props) => {
    return(
        <div className="portfolio d-lg-flex justify-content-center">
            {props.projects.map((project, index) => (
                <Project key={index} data={project}/>
            ))}
        </div>
    )
}

export default Portfolio