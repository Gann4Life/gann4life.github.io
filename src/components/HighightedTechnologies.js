import React from "react"
import Technology from "./Technology"

const HighlightedTechnologies = (props) => {
    return (
        <div>
            <div className="d-flex justify-content-evenly">
                {props.main_tech.map(tech => (<Technology tech={tech}/>))}
            </div>
            {
                props.other_tech.length > 0 
                ?<div className="d-flex justify-content-evenly text-muted">
                    {props.other_tech.map(tech => (<p>{tech}</p>))}
                </div>
                : ""
            }
        </div>
    )
}

export default HighlightedTechnologies