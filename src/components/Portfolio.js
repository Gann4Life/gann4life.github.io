import React, { useEffect } from "react"
import Project from "./Project"

const Portfolio = (props) => {

    useEffect(()=>{
    }, [])

    return(
        <div className="portfolio d-lg-flex">
            {props.projects.map((project, index) => (
                <Project key={index} data={project}/>
            ))}
        </div>
    )
}

export default Portfolio