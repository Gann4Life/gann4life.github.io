import React from "react"
import Technology from "./Technology"

const HighlightedTechnologies = (props) => {
    return (
        <div>
            <div className="d-lg-flex justify-content-evenly">
                <p className="my-2">Learned about:</p>
                {props.main_tech.map(tech => (<Technology tech={tech}/>))}
            </div>
            {
                props.other_tech.length > 0 
                ?<p className="text-muted">and {props.other_tech.join(", ")}</p>
                : ""
            }
        </div>
    )
}

export default HighlightedTechnologies